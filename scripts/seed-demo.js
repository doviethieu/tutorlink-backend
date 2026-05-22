const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Tutor = require('../src/models/Tutor');
const AvailabilitySlot = require('../src/models/AvailabilitySlot');
const Booking = require('../src/models/Booking');
const Session = require('../src/models/Session');
const Payment = require('../src/models/Payment');
const Payout = require('../src/models/Payout');
const Review = require('../src/models/Review');
const Favorite = require('../src/models/Favorite');
const SystemConfig = require('../src/models/SystemConfig');

const PASSWORD = 'Demo@12345';

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function dayIdxFromDate(dateString) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  const utcDay = date.getUTCDay();
  return utcDay === 0 ? 6 : utcDay - 1;
}

async function upsertUser({ email, fullName, role, phone = '' }) {
  const password = await bcrypt.hash(PASSWORD, 12);
  return User.findOneAndUpdate(
    { email },
    {
      fullName,
      email,
      role,
      phone,
      password,
      isActive: true,
      emailVerified: true,
      deletedAt: null,
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
}

async function main() {
  await connectDB();

  try {
    await Tutor.collection.dropIndex('status_1_subjects_1_levels_1_price_1');
    console.log('[seed-demo] dropped legacy parallel-array tutor index');
  } catch (error) {
    if (error.codeName !== 'IndexNotFound') {
      console.warn('[seed-demo] skip drop legacy tutor index:', error.message);
    }
  }

  const [admin, student, tutorUser] = await Promise.all([
    upsertUser({ email: 'admin@tutorlink.local', fullName: 'Admin TutorLink', role: 'admin', phone: '0900000001' }),
    upsertUser({ email: 'student@tutorlink.local', fullName: 'Nguyen Minh Anh', role: 'student', phone: '0900000002' }),
    upsertUser({ email: 'tutor@tutorlink.local', fullName: 'Tran Gia Bao', role: 'tutor', phone: '0900000003' }),
  ]);

  const tutor = await Tutor.findOneAndUpdate(
    { userId: tutorUser._id },
    {
      userId: tutorUser._id,
      slug: 'tran-gia-bao-demo',
      fullName: tutorUser.fullName,
      full_name: tutorUser.fullName,
      email: tutorUser.email,
      phone: tutorUser.phone,
      headline: 'Gia sư Toán THPT, luyện thi đại học',
      bio: 'Kèm Toán mất gốc đến nâng cao, tập trung tư duy giải nhanh và lộ trình cá nhân hóa.',
      description: 'Kèm Toán mất gốc đến nâng cao, tập trung tư duy giải nhanh và lộ trình cá nhân hóa.',
      location: 'Hà Nội',
      format: 'online',
      subjects: ['Toán', 'Đại số', 'Hình học'],
      levels: ['Lớp 10', 'Lớp 11', 'Lớp 12'],
      price: 250000,
      education: [{ school: 'Đại học Sư phạm Hà Nội', degree: 'Cử nhân Sư phạm Toán', major: 'Toán học', year: '2024' }],
      experience: [{ company: 'TutorLink Demo', role: 'Gia sư Toán', description: '3 năm luyện thi THPT', from: '2023', to: 'nay' }],
      certificates: ['Chứng chỉ nghiệp vụ sư phạm'],
      skills: 'Luyện thi THPT, Toán mất gốc, Giải nhanh trắc nghiệm',
      status: 'approved',
      averageRating: 5,
      rating: 5,
      totalReviews: 1,
      review_count: 1,
      session_count: 1,
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );

  const tomorrow = isoDate(addDays(new Date(), 1));
  const completedDate = isoDate(addDays(new Date(), -2));
  const dayIdx = dayIdxFromDate(tomorrow);
  const completedDayIdx = dayIdxFromDate(completedDate);

  await AvailabilitySlot.deleteMany({ tutorId: tutor._id });
  await AvailabilitySlot.insertMany([
    { tutorId: tutor._id, tutorUserId: tutorUser._id, dayIdx, hour: 19, recurring: true },
    { tutorId: tutor._id, tutorUserId: tutorUser._id, dayIdx, hour: 20, recurring: true },
    { tutorId: tutor._id, tutorUserId: tutorUser._id, dayIdx: completedDayIdx, hour: 18, recurring: true },
  ]);

  const pendingBooking = await Booking.findOneAndUpdate(
    { tutorId: tutor._id, studentId: student._id, date: tomorrow, startTime: '19:00' },
    {
      tutorId: tutor._id,
      tutorUserId: tutorUser._id,
      studentId: student._id,
      studentName: student.fullName,
      studentEmail: student.email,
      studentPhone: student.phone,
      date: tomorrow,
      startTime: '19:00',
      duration: 1,
      amount: 250000,
      subject: 'Toán',
      format: 'online',
      goal: 'Ôn tập khảo sát hàm số',
      status: 'pending',
      paymentStatus: 'unpaid',
      escrowStatus: 'none',
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );

  const completedBooking = await Booking.findOneAndUpdate(
    { tutorId: tutor._id, studentId: student._id, date: completedDate, startTime: '18:00' },
    {
      tutorId: tutor._id,
      tutorUserId: tutorUser._id,
      studentId: student._id,
      studentName: student.fullName,
      studentEmail: student.email,
      studentPhone: student.phone,
      date: completedDate,
      startTime: '18:00',
      duration: 1,
      amount: 250000,
      subject: 'Toán',
      format: 'online',
      goal: 'Ôn luyện phương trình mũ logarit',
      status: 'completed',
      paymentStatus: 'paid',
      escrowStatus: 'held',
      paidAt: new Date(),
      meetingUrl: `/room/booking-${new mongoose.Types.ObjectId()}`,
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );

  await Session.findOneAndUpdate(
    { bookingId: completedBooking._id },
    {
      bookingId: completedBooking._id,
      tutorId: tutor._id,
      tutorUserId: tutorUser._id,
      studentId: student._id,
      date: completedDate,
      startTime: '18:00',
      duration: 1,
      status: 'completed',
      completedAt: new Date(),
      meetingUrl: completedBooking.meetingUrl,
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );

  await Payment.findOneAndUpdate(
    { transactionRef: 'DEMO_ESCROW_001' },
    {
      bookingId: completedBooking._id,
      studentId: student._id,
      tutorId: tutor._id,
      tutorUserId: tutorUser._id,
      type: 'charge',
      gateway: 'sandbox',
      amount: 250000,
      currency: 'VND',
      status: 'succeeded',
      escrowStatus: 'held',
      transactionRef: 'DEMO_ESCROW_001',
      paidAt: new Date(),
      metadata: { seed: true },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );

  await Review.findOneAndUpdate(
    { bookingId: completedBooking._id },
    {
      bookingId: completedBooking._id,
      tutorId: tutor._id,
      studentId: student._id,
      rating: 5,
      body: 'Gia sư giảng dễ hiểu, đúng trọng tâm.',
      tutorReply: { body: 'Cảm ơn em, hẹn gặp lại ở buổi tiếp theo.', createdAt: new Date() },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );

  await Favorite.findOneAndUpdate(
    { studentId: student._id, tutorId: tutor._id },
    { studentId: student._id, tutorId: tutor._id },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );

  await Payout.deleteMany({ tutorId: tutor._id, note: 'Demo payout chờ admin duyệt' });
  await SystemConfig.updateOne(
    { key: 'auto_cancel_pending_hours' },
    { value: 24, description: 'Số giờ chờ trước khi tự hủy booking pending', updatedBy: admin._id },
    { upsert: true },
  );
  await SystemConfig.updateOne(
    { key: 'session_autocomplete_grace_hours' },
    { value: 2, description: 'Số giờ grace sau giờ kết thúc trước khi auto-complete session', updatedBy: admin._id },
    { upsert: true },
  );

  console.log('\nSeed demo complete.');
  console.log('Accounts:');
  console.log(`- Admin:   admin@tutorlink.local / ${PASSWORD}`);
  console.log(`- Student: student@tutorlink.local / ${PASSWORD}`);
  console.log(`- Tutor:   tutor@tutorlink.local / ${PASSWORD}`);
  console.log(`Tutor profile: ${tutor.fullName} (${tutor._id})`);
  console.log(`Pending booking: ${pendingBooking._id}`);
  console.log(`Completed escrow booking: ${completedBooking._id}\n`);
}

main()
  .catch((error) => {
    console.error('[seed-demo] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
