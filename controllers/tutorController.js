const Tutor = require('../models/Tutor');

// ============================================================
// 1. TÌM KIẾM VÀ LỌC DANH SÁCH GIA SƯ (Công khai - Khớp TC-TUT-005 & TC-TUT-006)
// ============================================================
exports.getPublicTutors = async (req, res) => {
    try {
        const { subject, search, page = 1, limit = 10 } = req.query;
        
        // 🚨 CHỐT CHẶN TỐI CAO: Chỉ lôi các gia sư ĐÃ ĐƯỢC ADMIN DUYỆT lên sàn
        let query = { status: 'approved' };

        // Lọc theo môn học nếu Frontend truyền lên (?subject=Toán)
        if (subject) {
            query.subjects = { $in: [subject] }; // Giả định trường subjects trong DB là mảng
        }

        // Tìm kiếm theo tên hoặc mô tả (?search=Nguyễn)
        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: 'i' } }, // 'i' là không phân biệt hoa thường
                { bio: { $regex: search, $options: 'i' } }
            ];
        }

        // Tính toán thuật toán phân trang (Pagination) để bảo vệ hiệu năng hệ thống
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const tutors = await Tutor.find(query)
            .sort({ averageRating: -1, totalReviews: -1 }) // Ưu tiên ông nào nhiều sao, nhiều review lên đầu
            .skip(skip)
            .limit(parseInt(limit));

        const totalTutors = await Tutor.countDocuments(query);

        res.status(200).json({
            status: 'success',
            data: tutors,
            pagination: {
                total: totalTutors,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(totalTutors / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: "Lỗi hệ thống khi tải danh sách gia sư!", error: error.message });
    }
};

// ============================================================
// 2. XEM CHI TIẾT HỒ SƠ 1 GIA SƯ (Công khai - Khớp TC-TUT-007)
// ============================================================
exports.getTutorById = async (req, res) => {
    try {
        const { id } = req.params;
        // Bóc tách chi tiết hồ sơ
        const tutor = await Tutor.findById(id);
        
        if (!tutor) {
            return res.status(404).json({ status: 'error', message: "Không tìm thấy hồ sơ gia sư này hoặc đã bị gỡ!" });
        }
        
        res.status(200).json({ status: 'success', data: tutor });
    } catch (error) {
        res.status(500).json({ status: 'error', message: "Lỗi hệ thống khi tìm kiếm!", error: error.message });
    }
};

// ============================================================
// 3. ĐĂNG KÝ LÊN LÀM GIA SƯ (Bảo mật - Khớp TC-TUT-001)
// ============================================================
exports.registerAsTutor = async (req, res) => {
    try {
        const userId = req.user.id; // Lấy an toàn từ token, không cho truyền lậu bậy bạ qua body
        const { subjects, price, bio, experience } = req.body;

        // Check xem tài khoản này đã từng đăng ký gia sư chưa
        const existingTutor = await Tutor.findOne({ userId });
        if (existingTutor) {
            return res.status(409).json({ status: 'error', message: "Tài khoản của bạn đã gửi hồ sơ gia sư rồi, vui lòng đợi duyệt!" });
        }

        const newTutor = new Tutor({
            userId,
            subjects,
            price,
            bio,
            experience,
            status: 'pending_review' // 🔄 Ép trạng thái về 'Chờ duyệt' để chuyển sang cho Admin Controller bốc bài
        });

        await newTutor.save();
        res.status(201).json({ status: 'success', message: "Nộp hồ sơ thành công! Đang chờ Ban quản trị xét duyệt.", data: newTutor });
    } catch (error) {
        res.status(500).json({ status: 'error', message: "Lỗi không thể lưu hồ sơ đăng ký!", error: error.message });
    }
};