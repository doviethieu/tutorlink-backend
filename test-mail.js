const nodemailer = require('nodemailer');
require('dotenv').config(); // thêm dòng này

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

console.log("Đang gõ cửa Google...");

transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER,
    subject: 'Test gửi mail',
    text: 'Nếu nhận được mail này thì cấu hình đã OK!'
}, (err, info) => {
    if (err) {
        console.log("THẤT BẠI:", err.message);
    } else {
        console.log("THÀNH CÔNG:", info.response);
    }
});