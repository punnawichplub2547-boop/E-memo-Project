# Design: อนิเมชั่นชวนกด "ดูคู่มือการใช้งานระบบ" (หน้า Login)

วันที่: 2026-07-06
สถานะ: approved (คุณพลับ — "เริ่มเลย", หลังปรึกษา cruella)

## ขอบเขต (YAGNI)

ทำให้ลิงก์ "ใช้งานครั้งแรก? ดูคู่มือการใช้งานระบบ" ใน `src/app/login/page.tsx`
(ท้ายกล่อง login card, ใต้ลิงก์ "ลงทะเบียน") ดึงสายตาและน่ากดมากขึ้น
โดยไม่รบกวนผู้ใช้ที่มา login ปกติ และใช้งานได้ทั้ง desktop/mobile/keyboard.

**ทำ:**
- แปลงลิงก์จาก inline-style ธรรมดาเป็น "helper chip" (pill พื้นหลัง tint) — เป็นตัวดึงสายตา
  หลักแบบ static ทำงานได้ทุกอุปกรณ์โดยไม่ต้องพึ่ง motion
- Entrance cue แบบ one-shot ตอนโหลดหน้า (fade+slide-up + ไอคอน pulse ครั้งเดียว)
- Hover/focus reward: shimmer sweep (reuse `emShimmer` keyframes เดิม) ทำงานครั้งเดียวต่อการ
  hover-enter/focus-enter หนึ่งครั้ง ไม่ loop ค้าง
- `:focus-visible` ต้องได้ effect เท่า `:hover` (คนใช้คีย์บอร์ด tab ไม่ตกหล่น)
- เคารพ `@media (prefers-reduced-motion: reduce)` ที่มี block นี้อยู่แล้วในไฟล์เดียวกัน (ดู
  section 2 — ไม่ใช่ block ใน `globals.css`, หน้า login มี block ของตัวเองแยกต่างหาก)

**ไม่ทำ:**
- ไม่แตะหน้า `/manual` เอง (cover, sections) — คนที่เปิดหน้านั้นแล้วคือกดเข้ามาแล้ว ไม่ต้องชวนซ้ำ
- ไม่ใช้ไอคอนเด้ง loop ต่อเนื่อง (anti-pattern บนหน้า login ตามที่ cruella flag — รบกวนสมาธิคนกรอกฟอร์มปกติ)
- ไม่ reuse `pulse-dot` (จะสับสนกับ unread notification badge จริง)
- ไม่เพิ่ม JS/state ใดๆ — ทั้งหมดเป็น CSS ล้วน
- ไม่แตะ layout/behavior อื่นของหน้า login (email/password field, submit logic)

> **เหตุผลที่ตัดข้อเสนอเดิม (A ไอคอนเด้ง loop + B shimmer-only-on-hover):**
> ปรึกษา cruella แล้วพบว่า A รบกวนคนที่มา login ปกติ (loop ไม่จบ) และ B แก้โจทย์ผิดข้อ
> (hover เกิด*หลัง*ผู้ใช้เจอลิงก์แล้ว ไม่ใช่ตัวดึงสายตาให้เจอตั้งแต่แรก และมือถือไม่มี hover เลย)
> ดีไซน์ที่อนุมัติจึงให้ visual hierarchy (static chip) ทำงานหนักแทน motion, ส่วน motion
> เหลือแค่เป็นของแต่งปลาย (entrance one-shot + hover/focus reward)

## 1. Markup — `src/app/login/page.tsx` (~line 669-684)

เปลี่ยนจาก `<Link>` ที่มี inline `style={{...}}` เป็น `<Link className="em-manual-cta">`
ห่อ SVG icon + ข้อความเดิมไว้ข้างใน ไม่เปลี่ยนข้อความ/ไอคอน/href (`/manual`) ไม่เปลี่ยน logic
ของหน้า login แต่อย่างใด — เปลี่ยนแค่วิธี style ตัว element เดียวนี้

## 2. CSS — `src/app/login/page.tsx` (inline `<style>{`...`}</style>` ที่มีอยู่แล้ว, บรรทัด 39-377)

> **แก้ไขจากร่างแรก:** ตอนเขียน spec รอบแรกเข้าใจผิดว่าหน้า login ใช้ class จาก `globals.css`
> แต่จริงๆ หน้านี้มี `<style>` ของตัวเองฝังอยู่ใน component (เก็บ keyframes/`.em-*` class
> เฉพาะของหน้า login ล้วนๆ เช่น `.em-form-wrap`, `.em-feat`, `.em-login-streak`) รวมถึงมี
> `@media (prefers-reduced-motion: reduce)` เป็นของตัวเองที่บรรทัด 372-376 (ไม่ใช่ตัวเดียวกับ
> `globals.css:813` ที่ใช้กับหน้า create-memo) — Section นี้แก้ให้ตรงกับของจริงในโค้ดแล้ว
> ยังคง reuse keyframes `emShimmer` ได้ตามเดิม เพราะ `globals.css` ถูก import ที่ root
> `layout.tsx` ทำให้ keyframes ของมัน available ทั่วทั้งแอปอยู่แล้ว ไม่ต้อง duplicate

Class ใหม่ `.em-manual-cta` (ตาม pattern `em-` ที่ใช้ทั้งไฟล์นี้) เพิ่มเข้าไปในกลุ่ม CSS ที่มีอยู่แล้ว
(ต่อจาก `.em-login-btn` ก่อนถึง `.em-feat`):

**Static shape (ตัวดึงสายตาหลัก ไม่ใช้ motion):**
- `display: inline-flex; align-items: center; gap: 7px;`
- พื้นหลัง `rgba(37, 99, 235, 0.06)` (tint จากสี brand เดิม `#2563EB` ที่ใช้อยู่แล้วในลิงก์ icon)
- border `1px solid rgba(37, 99, 235, 0.14)`
- `border-radius: 999px; padding: 6px 12px;`
- สีตัวอักษรคงเดิม (`#475569`, contrast ผ่าน ~7:1 อยู่แล้ว) — เช็ก contrast ซ้ำกับพื้น chip ใหม่
  ให้ยังผ่าน WCAG AA

**Entrance animation (one-shot):**
```css
@keyframes emCtaIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.em-manual-cta {
  animation: emCtaIn 550ms cubic-bezier(0.22, 1, 0.36, 1) 700ms both;
}
.em-manual-cta svg {
  animation: emCtaIconPulse 500ms ease-in-out 900ms both;
}
@keyframes emCtaIconPulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.08); }
}
```
(delay ของ icon pulse เริ่มหลัง chip เริ่ม fade-in ~200ms ให้ดูเป็นจังหวะต่อเนื่อง ไม่ชนกัน)

**Hover/focus reward (reuse `emShimmer`, one-shot ต่อการ enter):**
```css
.em-manual-cta {
  position: relative;
  overflow: hidden;
}
.em-manual-cta::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(120deg, transparent 30%, rgba(37,99,235,0.18) 50%, transparent 70%);
  transform: translateX(-100%);
  pointer-events: none;
}
.em-manual-cta:hover::after,
.em-manual-cta:focus-visible::after {
  animation: emShimmer 700ms ease-out;
}
```
ใช้ keyframes `emShimmer` เดิมที่มีอยู่แล้วใน `globals.css:207` (available ทั่วแอปตามที่อธิบายข้างบน)
— ไม่ต้องเพิ่ม keyframe ใหม่สำหรับส่วนนี้ `:focus-visible` ประกาศคู่กับ `:hover` เสมอทุกเส้น
เพื่อไม่ให้คีย์บอร์ดตกหล่น

**Reduced motion (ต่อรายการ class เดิมใน local block ของไฟล์นี้ที่บรรทัด 372-376):**
```css
@media (prefers-reduced-motion: reduce) {
  .em-login-streak, .em-mobile-atmos .em-orb-top, .em-mobile-atmos .em-orb-bottom,
  .em-mb-logo, .em-car-logo-square, .em-car-logo-square::after,
  .em-car-logo-square img, .em-feat, .em-form-wrap,
  .em-manual-cta, .em-manual-cta svg, .em-manual-cta::after { animation: none !important; }
}
```
Chip ยังคงแสดงผล static (พื้นหลัง tint + border) ครบถ้วน สื่อความหมายได้โดยไม่ต้องขยับ

## Timing / Easing Reference (จาก cruella)

| จังหวะ | ค่า |
|---|---|
| Entrance delay | 700ms |
| Entrance duration | 550ms |
| Entrance easing | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Icon pulse scale | สูงสุด 1.08 (ห้ามเกิน 1.2) |
| translateY entrance | สูงสุด -6px |
| Shimmer hover/focus sweep | 700ms ease-out ต่อการ enter 1 ครั้ง |
| ห้ามใช้ | `linear` easing, overshoot เกิน ~8%, loop ถี่กว่า 4s, motion วนไม่จบบนหน้า login |

## Accessibility Checklist

1. `prefers-reduced-motion: reduce` → ปิด animation ทั้งหมด เหลือ static chip
2. `:focus-visible` ได้ effect เท่า `:hover` ทุกเส้น (ไม่ผูกการค้นพบไว้กับ hover เท่านั้น)
3. Static chip (ข้อ 1 ใน UI) ทำงานได้ทั้ง touch/desktop โดยไม่พึ่ง hover — แก้ปัญหา "มือถือไม่มี hover"
4. Contrast: ข้อความ `#475569` บนพื้น chip tint ใหม่ต้องเช็กผ่าน DevTools ว่ายังผ่าน AA (≥4.5:1)

## Testing

Pure CSS + markup class เปลี่ยนแค่ elemenet เดียว ไม่มี logic ใหม่ให้ unit test
(ไม่มี state/behavior เปลี่ยนในหน้า login) — ตรวจสอบด้วยตาจริงผ่าน dev server:

- Desktop viewport: entrance cue เล่นครั้งเดียวตอนโหลดหน้า, hover แล้ว shimmer วิ่งครั้งเดียว
- Mobile viewport (390px): chip อ่านออกและกดง่ายโดยไม่ต้อง hover
- Keyboard: Tab ไปถึงลิงก์ → เห็น shimmer/focus effect เหมือน hover
- DevTools "Emulate CSS prefers-reduced-motion: reduce" → ไม่มี motion เหลือ, chip ยังอ่านออกปกติ
- `npm.cmd run lint` + `npm.cmd run build` ผ่าน (กัน syntax error ใน inline `<style>`/JSX)

## ความเสี่ยง / หมายเหตุ

- ไม่มีการเปลี่ยน DOM structure ที่กระทบ test/selector อื่น (ไม่มี test ใดอ้างอิง class เดิมของลิงก์นี้)
- Chip tint ใช้สี brand เดิมที่มีอยู่แล้วในระบบ (ไม่เพิ่ม CSS variable สีใหม่)
- ถ้าอนาคตอยากเพิ่มทางเข้า `/manual` จุดอื่น (เช่น topbar หลังล็อกอิน) เป็นงานแยก ไม่รวมในสโคปนี้
