const Tutor = require('../models/Tutor');
const mongoose = require('mongoose'); // 🔥 ĐÃ THÊM: Để bọc bảo vệ định dạng ObjectId an toàn

// Helper hỗ trợ vô hiệu hóa các ký tự đặc biệt độc hại trong chuỗi Regex tìm kiếm
const escapeRegex = (text) => {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

// ============================================================
// 1. TÌM KIẾM VÀ LỌC DANH SÁCH GIA SƯ (Công khai - Khớp TC-TUT-005 & TC-TUT-006)
// ============================================================
exports.getPublicTutors = async (req, res) => {
    try {
        let { subject, search, page = 1, limit = 10 } = req.query;
        
        // 🛠️ ĐÃ GIA CỐ 1: Ép kiểu dữ liệu phân trang an toàn, chặn hoàn toàn lỗi chia cho 0 hoặc NaN
        let safePage = parseInt(page) || 1;
        let safeLimit = parseInt(limit) || 10;
        if (safePage < 1) safePage = 1;
        if (safeLimit < 1) safeLimit = 10;

        // 🚨 CHỐT CHẶN TỐI CAO: Chỉ lôi các gia sư ĐÃ ĐƯỢC ADMIN DUYỆT lên sàn
        let query = { status: 'approved' };

        // Lọc theo môn học nếu Frontend truyền lên (?subject=Toán)
        if (subject && subject.trim() !== "") {
            query.subjects = { $in: [subject.trim()] }; 
        }

        // Tìm kiếm theo tên hoặc mô tả (?search=Nguyễn)
        if (search && search.trim() !== "") {
            // 🛠️ ĐÃ GIA CỐ 2: Xử lý làm sạch chuỗi tránh crash biểu thức Regex hệ thống
            const cleanSearch = escapeRegex(search.trim());
            query.$or = [
                { fullName: { $regex: cleanSearch, $options: 'i' } }, 
                { bio: { $regex: cleanSearch, $options: 'i' } }
            ];
        }

        // Tính toán thuật toán phân trang (Pagination) bảo vệ hiệu năng hệ thống
        const skip = (safePage - 1) * safeLimit;

        const tutors = await Tutor.find(query)
            .sort({ averageRating: -1, totalReviews: -1 }) // Ưu tiên ông nào nhiều sao, nhiều review lên đầu
            .skip(skip)
            .limit(safeLimit);

        const totalTutors = await Tutor.countDocuments(query);

        return res.status(200).json({
            status: 'success',
            data: tutors || [],
            pagination: {
                total: totalTutors,
                page: safePage,
                limit: safeLimit,
                pages: Math.ceil(totalTutors / safeLimit) || 1
            }
        });
    } catch (error) {
        console.error("🔴 Lỗi hệ thống tại getPublicTutors:", error);
        return res.status(500).json({ status: 'error', message: "Lỗi hệ thống khi tải danh sách gia sư!", error: error.message });
    }
};

// ============================================================
// 2. XEM CHI TIẾT HỒ SƠ 1 GIA SƯ (Công khai - Khớp TC-TUT-007)
// ============================================================
exports.getTutorById = async (req, res) => {
    try {
        const { id } = req.params;

        // 🛠️ ĐÃ GIA CỐ 3: Kiểm tra định dạng ID đầu vào để chặn đứng lỗi CastError sập 500
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: 'error', message: "Mã ID hồ sơ gia sư không đúng định dạng mã hóa hệ thống!" });
        }

        const tutor = await Tutor.findById(id);
        
        if (!tutor) {
            return res.status(404).json({ status: 'error', message: "Không tìm thấy hồ sơ gia sư này hoặc đã bị gỡ xuống sếp ơi!" });
        }
        
        return res.status(200).json({ status: 'success', data: tutor });
    } catch (error) {
        console.error("🔴 Lỗi hệ thống tại getTutorById:", error);
        return res.status(500).json({ status: 'error', message: "Lỗi hệ thống khi tìm kiếm chi tiết hồ sơ!", error: error.message });
    }
};

// ============================================================
// 3. ĐĂNG KÝ LÊN LÀM GIA SƯ (Bảo mật - Khớp TC-TUT-001)
// ============================================================
exports.registerAsTutor = async (req, res) => {
    try {
        // Kiểm tra an toàn Middleware giải mã token bảo mật protect
        if (!req.user || !req.user.id) {
            return res.status(401).json({ status: 'error', message: "Tài khoản chưa được xác thực token đăng nhập hệ thống!" });
        }
        const userId = req.user.id; 
        const { subjects, price, bio, experience } = req.body;

        if (!subjects || subjects.length === 0 || !price) {
            return res.status(400).json({ status: 'error', message: "Vui lòng điền đầy đủ môn học giảng dạy và giá học phí mong muốn!" });
        }

        // Check xem tài khoản này đã từng đăng ký gia sư chưa (Bọc ép kiểu an toàn)
        if (mongoose.Types.ObjectId.isValid(userId)) {
            const existingTutor = await Tutor.findOne({ userId });
            if (existingTutor) {
                return res.status(409).json({ status: 'error', message: "Tài khoản của bạn đã gửi hồ sơ gia sư rồi, vui lòng đợi duyệt!" });
            }
        }

        const newTutor = new Tutor({
            userId,
            subjects,
            price,
            bio: bio || '',
            experience: experience || '',
            status: 'pending_review' // 🔄 Ép trạng thái về 'Chờ duyệt' để chuyển sang cho Admin Controller bốc bài
        });

        await newTutor.save();
        return res.status(201).json({ status: 'success', message: "Nộp hồ sơ thành công! Đang chờ Ban quản trị xét duyệt.", data: newTutor });
    } catch (error) {
        console.error("🔴 Lỗi hệ thống tại registerAsTutor:", error);
        return res.status(500).json({ status: 'error', message: "Lỗi hệ thống không thể lưu hồ sơ đăng ký gia sư!", error: error.message });
    }
};