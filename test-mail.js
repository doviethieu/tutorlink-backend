const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        // ĐIỀN CHÍNH XÁC EMAIL SẾP VỪA DÙNG ĐỂ TẠO MẬT KHẨU
        user: 'doviethieu1008@gmail.com', 
        
        // DÁN MẬT KHẨU 16 CHỮ VÀO ĐÂY (VIẾT LIỀN, KHÔNG DẤU CÁCH)
        pass: 'yeuszcffzppfiimf' 
    }
});

console.log("Đang gõ cửa Google...");

transporter.sendMail({
    from: 'ĐIỀN_LẠI_EMAIL_VÀO_ĐÂY@gmail.com',
    to: 'ĐIỀN_LẠI_EMAIL_VÀO_ĐÂY@gmail.com', // Tự gửi cho chính mình test
    subject: 'Test thông chốt Google',
    text: 'Nếu nhận được mail này thì Mật khẩu 16 chữ đã ok!'
}, (err, info) => {
    if (err) {
        console.log("THẤT BẠI: Vẫn sai cặp Email/Pass. Hãy tạo lại pass 16 chữ mới cho Email này!", err.message);
    } else {
        console.log("THÀNH CÔNG RỒi!", info.response);
    }
});