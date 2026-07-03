/**
 * The eight content sections of the manual. Text content is authoritative (kept
 * from the reviewed source manual); only the presentation was re-skinned onto
 * the app's design tokens. Each <section> id matches a TOC anchor in page.tsx.
 */
import {
  LoginShot,
  DashboardShot,
  CreateDetailsShot,
  MdReviewShot,
  RoutingShot,
  QueueShot,
  HistoryShot,
  ProfileShot,
} from "./manual-mockups";

export function ManualSections() {
  return (
    <main className="man-main">
      {/* 1. LOGIN */}
      <section id="sec-login" className="man-section">
        <div className="man-eyebrow">ขั้นตอนที่ 1</div>
        <h2>เข้าสู่ระบบ</h2>
        <p className="man-section-desc">ระบบใช้อีเมลบริษัท (@car-1996.com) และรหัสผ่านที่ได้รับหลังลงทะเบียน เข้าถึงได้ทุกที่ผ่านเบราว์เซอร์ที่ <b>memo.car-1996.com</b></p>
        <div className="man-rule" />

        <LoginShot />

        <ul className="man-plain" style={{ marginTop: 20 }}>
          <li><b>Company Email</b> — ใช้อีเมลบริษัทเท่านั้น เช่น <code>name@car-1996.com</code></li>
          <li><b>Password</b> — กดไอคอนรูปตาเพื่อแสดง/ซ่อนรหัสผ่านที่พิมพ์</li>
          <li><b>ลืมรหัสผ่าน?</b> — ลิงก์ตั้งรหัสผ่านใหม่ผ่านอีเมล</li>
          <li><b>ยังไม่มีบัญชี? ลงทะเบียน</b> — สมัครด้วยเลขบัตรพนักงาน แล้วรอแอดมินอนุมัติสิทธิ์ก่อนใช้งานได้</li>
        </ul>
        <div className="man-callout blue">
          <div className="ic">i</div>
          <div><b>บัญชีใหม่ต้องรอแอดมินอนุมัติก่อน</b>หลังลงทะเบียนเสร็จ ระบบจะแสดงสถานะ &ldquo;รออนุมัติจากแอดมิน&rdquo; — ยังเข้าใช้งานไม่ได้จนกว่าแอดมินจะกำหนดบทบาท (role) ให้</div>
        </div>
      </section>

      {/* 2. DASHBOARD */}
      <section id="sec-dashboard" className="man-section">
        <div className="man-eyebrow">ขั้นตอนที่ 2</div>
        <h2>หน้า Dashboard</h2>
        <p className="man-section-desc">หน้าแรกหลังเข้าสู่ระบบ สรุปภาพรวมงานที่ต้องทำและสถิติการอนุมัติของคุณ</p>
        <div className="man-rule" />

        <DashboardShot />

        <ul className="man-plain" style={{ marginTop: 20 }}>
          <li><b>การ์ดสีเข้มด้านบน</b> — ทักทายตามเวลาจริง และบอกจำนวนเอกสารที่รอคุณอนุมัติ กด &ldquo;Review Queue&rdquo; เพื่อไปดูทันที</li>
          <li><b>4 การ์ด KPI</b> — จำนวนเมโมทั้งหมด / รออนุมัติ / อนุมัติแล้ว / เวลาเฉลี่ยต่อฉบับ เทียบกับสัปดาห์ก่อนหน้า</li>
          <li><b>AI Insight</b> — สรุปเวลาเฉลี่ยที่แต่ละระดับใช้พิจารณา (Manager / GM / MD) เพื่อดูว่าฉบับไหนเกินเกณฑ์</li>
          <li><b>Recent Activity</b> — feed เหตุการณ์ล่าสุดที่เกี่ยวข้องกับคุณ เรียงตามเวลา</li>
        </ul>
      </section>

      {/* 3. CREATE MEMO */}
      <section id="sec-create" className="man-section">
        <div className="man-eyebrow">ขั้นตอนที่ 3 — ส่วนที่ใช้บ่อยที่สุด</div>
        <h2>สร้างและส่งเมโม</h2>
        <p className="man-section-desc">คลิก <b>Create Memo</b> ในเมนูซ้าย หรือปุ่ม <b>+ New Memo</b> มุมขวาบนได้จากทุกหน้า ฟอร์มแบ่งเป็น 3 ขั้นตอนต่อเนื่องในหน้าเดียว</p>
        <div className="man-rule" />

        <h3 className="man-step-title"><span className="man-step-badge">1</span> รายละเอียด Memo</h3>
        <p>กรอกเรื่อง หมวดรายการ แผนก และจำนวนเงิน — ระบบจะออกเลขที่เอกสารให้อัตโนมัติเมื่อกดส่ง และแสดงชื่อผู้จัดทำ/เวลาปัจจุบันไว้ให้แล้ว</p>

        <CreateDetailsShot />

        <ul className="man-plain" style={{ marginTop: 18 }}>
          <li><b>หมวดรายการ</b> เป็นตัวกำหนดสายอนุมัติ — เลือกให้ตรงประเภทงานจริงเสมอ (วัตถุดิบ / สินทรัพย์ถาวร / การว่าจ้าง-สัญญา / ซื้อทั่วไป / แม่พิมพ์)</li>
          <li><b>สถานะงบประมาณ</b> ถ้าเลือก &ldquo;เกินงบ&rdquo; ระบบอาจยกระดับผู้อนุมัติสูงขึ้นอัตโนมัติตามยอดสะสมเกินงบของแผนกในเดือนนั้น</li>
          <li>เลื่อนลงจะพบส่วน <b>แนบไฟล์</b> (ใบเสนอราคา/เอกสารประกอบ สูงสุด 10MB), <b>เปรียบเทียบราคา</b> (รองรับคำนวณ VAT อัตโนมัติ) และ <b>ผู้รับทราบ (Read Recipients)</b> สำหรับคนที่ต้องรู้แต่ไม่ต้องอนุมัติ</li>
        </ul>

        <h3 className="man-step-title" id="sec-mdreview"><span className="man-step-badge warn">!</span> เงื่อนไขพิเศษตาม Book1</h3>
        <p>หากรายการเข้าเงื่อนไขพิเศษของ Book1 ให้ติ๊กช่องที่เกี่ยวข้องในกล่อง &ldquo;เงื่อนไขเพิ่มเติม (Book1)&rdquo; — ที่สำคัญที่สุดคือ <b>Supplier ปรับราคา</b> ซึ่งเป็นฟีเจอร์ล่าสุดของระบบ</p>

        <MdReviewShot />

        <div className="man-callout gold">
          <div className="ic">★</div>
          <div><b>MD Review คือ &ldquo;ประตูบังคับ&rdquo; ไม่ใช่แค่แจ้งให้ทราบ</b>ตั้งแต่กรกฎาคม 2569 เป็นต้นไป เมโมที่ติ๊ก &ldquo;Supplier ปรับราคา&rdquo; (สำหรับวัตถุดิบหรือสินทรัพย์ถาวร) จะ<b>หยุดรอที่ขั้นตอน MD พิจารณาก่อน</b> — อนุมัติ/ตีกลับ/ปฏิเสธในขั้นถัดไปจะทำไม่ได้จนกว่า MD จะตอบกลับด้วยหนึ่งใน 4 ทางเลือก (ดูหัวข้อ &ldquo;สำหรับผู้อนุมัติ&rdquo;)</div>
        </div>

        <h3 className="man-step-title" id="sec-routing"><span className="man-step-badge">2</span> เส้นทางอนุมัติ (Approver Routing)</h3>
        <p>แผงด้านขวาของฟอร์มจะคำนวณและแนะนำผู้อนุมัติที่เหมาะสมให้อัตโนมัติตามกฎ Book1 ทันทีที่คุณกรอกหมวดรายการและจำนวนเงิน คุณสามารถ override เลือกเองได้ แต่ระบบจะขอเหตุผลประกอบเพื่อการตรวจสอบย้อนหลัง</p>

        <RoutingShot />

        <ul className="man-plain" style={{ marginTop: 18 }}>
          <li><b>TIER badge</b> — ระดับผู้อนุมัติสุดท้ายที่ระบบแนะนำ (Manager / GM / MD)</li>
          <li><b>กล่องเหตุผล</b> — อธิบายว่าทำไมระบบแนะนำระดับนี้ อ้างอิงข้อ Book1 เสมอ</li>
          <li><b>ROUTE STATUS</b> — ขึ้น &ldquo;recommended&rdquo; ถ้าใช้ตามคำแนะนำ, &ldquo;exception&rdquo; ถ้าคุณ override ให้สูง/ต่ำกว่าคำแนะนำ (ต้องกรอกเหตุผล)</li>
          <li>ขั้นตอน <b>Manager / Top Section เป็นด่านแรกเสมอ</b> (บังคับ) ก่อนจะส่งต่อไปยังระดับที่เลือกไว้</li>
        </ul>

        <h3 className="man-step-title"><span className="man-step-badge">3</span> ตรวจทานและส่ง</h3>
        <p>ขั้นสุดท้าย ระบบจะสรุปทุกข้อมูลให้ตรวจทานอีกครั้งก่อนกด <b>Send to Approval</b> หรือกด <b>Save Draft</b> เพื่อบันทึกไว้ทำต่อภายหลังโดยยังไม่ส่งเข้าสายอนุมัติ</p>
      </section>

      {/* 4. QUEUE */}
      <section id="sec-queue" className="man-section">
        <div className="man-eyebrow">ขั้นตอนที่ 4</div>
        <h2>ติดตามสถานะใน Approval Queue</h2>
        <p className="man-section-desc">ดูสถานะเอกสารทั้งหมดที่เกี่ยวข้องกับคุณ ทั้งที่คุณส่ง และที่รอคุณอนุมัติ (ถ้ามีสิทธิ์)</p>
        <div className="man-rule" />

        <QueueShot />

        <ul className="man-plain" style={{ marginTop: 18 }}>
          <li><b>แท็บสถานะ</b> — All / Pending / Approved / Rejected / Returned / Draft กรองรายการตามสถานะได้ทันที</li>
          <li><b>ตัวกรอง Tier และ Date</b> — มุมขวาบนตาราง ใช้เมื่อรายการเยอะ ต้องการหาเฉพาะเมโมของระดับหรือช่วงเวลาหนึ่ง</li>
          <li>คลิกที่แถวเพื่อเปิด <b>drawer รายละเอียด</b> — จะเห็นเนื้อหาเต็ม เอกสารแนบ เส้นทางอนุมัติ และไทม์ไลน์การดำเนินการ พร้อมปุ่ม Approve/Return/Reject ถ้าคุณมีสิทธิ์อนุมัติขั้นนั้น</li>
        </ul>
      </section>

      {/* 5. APPROVER */}
      <section id="sec-approver" className="man-section">
        <div className="man-eyebrow">ขั้นตอนที่ 5</div>
        <h2>สำหรับผู้อนุมัติ (Manager / GM / MD)</h2>
        <p className="man-section-desc">ถ้าบทบาทของคุณอยู่ในสายอนุมัติ เมื่อเปิด drawer รายละเอียดของเมโมที่รอคุณ จะเห็นปุ่มการทำงานที่ท้าย drawer</p>
        <div className="man-rule" />

        <ul className="man-plain">
          <li><b>Approve</b> — อนุมัติ ส่งเอกสารต่อไปขั้นถัดไปในเส้นทางอัตโนมัติ</li>
          <li><b>Return</b> — ตีกลับให้ผู้ขอแก้ไข พร้อมระบุเหตุผล เอกสารจะย้อนไปเริ่มที่ Manager ใหม่หลังแก้ไข</li>
          <li><b>Reject</b> — ปฏิเสธ เลือกได้ว่า &ldquo;ปิดถาวร&rdquo; หรือ &ldquo;อนุญาตให้แก้ไขและส่งใหม่&rdquo; (revision-allowed)</li>
        </ul>

        <div className="man-callout gold">
          <div className="ic">★</div>
          <div><b>ถ้าคุณคือ Managing Director และเมโมติดเครื่องหมาย &ldquo;ต้องผ่านการพิจารณาของ MD&rdquo;</b>ปุ่มจะเปลี่ยนเป็น 4 ทางเลือกเฉพาะสำหรับ MD Review แทนปุ่ม Approve ปกติ จนกว่าคุณจะตอบกลับ เอกสารจะขยับต่อไม่ได้เลย:</div>
        </div>
        <ul className="man-plain">
          <li><b>เห็นชอบ</b> — อนุมัติราคาที่ปรับ เอกสารเดินหน้าต่อในสายอนุมัติปกติทันที</li>
          <li><b>ไม่เห็นชอบ</b> — ปฏิเสธการปรับราคา เอกสารหยุด/ถูกตีกลับตามที่ตั้งค่า</li>
          <li><b>ให้ความเห็น</b> — พิมพ์ข้อความความเห็นกลับไปโดยไม่ปิดเรื่อง สามารถทำผ่านข้อความตอบกลับใน Telegram ได้เช่นกัน</li>
          <li><b>ขอให้แก้ไขใหม่</b> — ส่งกลับให้ผู้ขอแก้ไขรายละเอียดราคา/เหตุผล ก่อนจะพิจารณาอีกครั้ง</li>
        </ul>
      </section>

      {/* 6. HISTORY */}
      <section id="sec-history" className="man-section">
        <div className="man-eyebrow">ขั้นตอนที่ 6</div>
        <h2>ประวัติเอกสารและรายงาน</h2>
        <p className="man-section-desc">สรุปสถิติทุกเมโมที่ผ่านมือคุณ พร้อม timeline การอนุมัติแบบละเอียด ใช้สำหรับตรวจสอบย้อนหลังหรือรายงานผู้บริหาร</p>
        <div className="man-rule" />

        <HistoryShot />

        <ul className="man-plain" style={{ marginTop: 18 }}>
          <li><b>5 การ์ด KPI</b> — จำนวนที่ดำเนินการทั้งหมด / อัตราอนุมัติ / อัตราปฏิเสธ / เวลาเฉลี่ย / จำนวนที่ผ่านระดับ MD</li>
          <li><b>ตัวกรอง Range และ Actor</b> — เจาะช่วงเวลา หรือดูเฉพาะที่ผู้อนุมัติคนใดคนหนึ่งดำเนินการ</li>
          <li><b>ปุ่ม Export CSV</b> — ดาวน์โหลดข้อมูลออกไปทำรายงานต่อได้</li>
        </ul>
      </section>

      {/* 7. NOTIFY */}
      <section id="sec-notify" className="man-section">
        <div className="man-eyebrow">ขั้นตอนที่ 7</div>
        <h2>การแจ้งเตือนและ Telegram</h2>
        <p className="man-section-desc">ระบบแจ้งเตือน 2 ทางพร้อมกัน เพื่อให้ไม่พลาดเอกสารที่ต้องดำเนินการ</p>
        <div className="man-rule" />

        <ul className="man-plain">
          <li><b>กระดิ่งแจ้งเตือนในระบบ (มุมขวาบนทุกหน้า)</b> — แสดงจุดแดงเมื่อมีแจ้งเตือนใหม่ คลิกดูรายการ แล้วคลิกอีกครั้งเพื่อไปยังเมโมนั้นโดยตรง มีปุ่ม &ldquo;อ่านทั้งหมด&rdquo; ล้างสถานะได้ในคลิกเดียว</li>
          <li><b>Telegram</b> — ระบบเสริม ส่งแจ้งเตือนแบบ push ทันทีที่มีเอกสารรออนุมัติ พร้อมปุ่มกดอนุมัติ/ตีกลับ/ปฏิเสธได้จากในแชทเลย ไม่ต้องเปิดเว็บ</li>
        </ul>

        <div className="man-callout blue">
          <div className="ic">i</div>
          <div><b>วิธีผูกบัญชี Telegram</b>ไปที่หน้า &ldquo;โปรไฟล์ของฉัน&rdquo; (มุมล่างซ้าย) เลื่อนไปหัวข้อ Telegram แล้วทำตามลิงก์เชื่อมต่อบัญชี — ต้องทำครั้งเดียว หลังผูกแล้วจะได้รับข้อความแจ้งเตือนทันทีที่มีเอกสารเข้าคิว</div>
        </div>
      </section>

      {/* 8. PROFILE */}
      <section id="sec-profile" className="man-section">
        <div className="man-eyebrow">ขั้นตอนที่ 8</div>
        <h2>จัดการโปรไฟล์ของฉัน</h2>
        <p className="man-section-desc">ตรวจสอบข้อมูลบัญชี สถานะ session และผูก/ยกเลิก Telegram ได้ที่นี่</p>
        <div className="man-rule" />

        <ProfileShot />

        <ul className="man-plain" style={{ marginTop: 18 }}>
          <li><b>ข้อมูลบัญชี</b> — ชื่อ-นามสกุล รหัสบัตรพนักงาน อีเมล และแผนกของคุณ (แก้ไขเองไม่ได้ ติดต่อแอดมินหากข้อมูลผิด)</li>
          <li><b>เซสชันปัจจุบัน</b> — ระบบจะให้อยู่ในระบบได้ 8 ชั่วโมงต่อการเข้าสู่ระบบ 1 ครั้ง</li>
          <li><b>แจ้งปัญหาถึงแอดมิน</b> — พบปัญหาการใช้งาน กดปุ่มนี้เพื่อแจ้งตรงถึงผู้ดูแลระบบได้ทันที</li>
        </ul>
      </section>
    </main>
  );
}
