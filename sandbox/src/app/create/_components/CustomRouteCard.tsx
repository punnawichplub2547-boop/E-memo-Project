"use client";

import { IconArrowDown, IconArrowUp, IconCrown, IconShield, IconUsers, IconX } from "@/components/icons";
import { ApproverPicker } from "./ApproverPicker";
import type { UseCustomRouteResult } from "../_hooks/useCustomRoute";

export function CustomRouteCard({
  route,
  notifyMD,
  notifyMDReason,
}: {
  route: UseCustomRouteResult;
  notifyMD: boolean;
  notifyMDReason?: string;
}) {
  return (
    <div className="em-card">
      <div className="em-card-head">
        <div>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconUsers size={15} style={{ color: "var(--primary)", flexShrink: 0 }} /> Customize route เอง
          </h3>
          <div className="em-sub">เลือกผู้อนุมัติเป็นรายบุคคลตามลำดับ · คนสุดท้าย = ผู้อนุมัติ</div>
        </div>
        <span className="em-tier mgr">{route.people.length} ลำดับ</span>
      </div>
      <div className="em-card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <ApproverPicker onPick={route.addPerson} />

        {route.people.length === 0 && (
          <div className="em-help">ยังไม่ได้เลือกผู้อนุมัติ — ต้องเลือกอย่างน้อย 1 คนจึงจะส่งขออนุมัติได้</div>
        )}

        {route.people.length > 0 && (
          <ol className="em-route-person-list">
            {route.people.map((person, index) => {
              const isApprover = route.roleOf(index) === "approve";
              const isSelf = route.selfPickedIndexes.includes(index);
              return (
                <li
                  key={`${person.userId}-${index}`}
                  className={`em-route-person${isApprover ? " is-approver" : ""}`}
                >
                  <span className="em-route-person-no">{index + 1}</span>
                  <div className="em-route-person-main">
                    <div className="em-route-person-name">
                      {person.name}
                      <span className="em-tier mgr" style={{ marginLeft: 6 }}>
                        {isApprover ? "อนุมัติ" : "ตรวจ/เห็นชอบ"}
                      </span>
                    </div>
                    <div className="em-route-person-meta">
                      {person.approvalLevel ?? "ไม่มีระดับอนุมัติ"}
                      {person.department ? ` · ${person.department}` : ""}
                    </div>
                    {isSelf && (
                      <div className="em-route-person-warn">
                        ⚠ คุณเลือกตัวเองในลำดับนี้ — ระบบไม่อนุญาตให้อนุมัติเมโมของตัวเอง เมโมจะค้างที่ขั้นนี้
                      </div>
                    )}
                  </div>
                  <div className="em-route-person-actions">
                    <button
                      type="button"
                      className="em-btn sm ghost"
                      title="เลื่อนขึ้น"
                      aria-label={`เลื่อน ${person.name} ขึ้น`}
                      onClick={() => route.movePerson(index, -1)}
                      disabled={index === 0}
                    >
                      <IconArrowUp size={13} style={{ flexShrink: 0 }} />
                    </button>
                    <button
                      type="button"
                      className="em-btn sm ghost"
                      title="เลื่อนลง"
                      aria-label={`เลื่อน ${person.name} ลง`}
                      onClick={() => route.movePerson(index, 1)}
                      disabled={index === route.people.length - 1}
                    >
                      <IconArrowDown size={13} style={{ flexShrink: 0 }} />
                    </button>
                    <button
                      type="button"
                      className="em-btn sm ghost"
                      title="ลบออก"
                      aria-label={`ลบ ${person.name} ออกจากลำดับ`}
                      onClick={() => route.removePerson(index)}
                    >
                      <IconX size={13} style={{ flexShrink: 0 }} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {notifyMD && (
          <div className="em-route-note is-md">
            <IconCrown size={14} style={{ color: "#7C5E0F", flexShrink: 0, marginTop: 2 }} />
            <div>
              เมโมนี้ยังต้องผ่านด่านพิจารณาของ MD หลังผู้ตรวจลำดับที่ 1 เสมอ — {notifyMDReason ?? "ตามกฎ Book1"}
            </div>
          </div>
        )}

        <div className="em-route-note">
          <IconShield size={12} style={{ color: "var(--primary)", flexShrink: 0, marginTop: 2 }} />
          <div>
            ผู้ที่อยู่ลำดับก่อนสุดท้ายมีสิทธิ์ <b>ตีกลับให้แก้ไข</b> ได้ แต่ <b>ปฏิเสธไม่ได้</b> —
            สิทธิ์ปฏิเสธเป็นของผู้อนุมัติลำดับสุดท้ายเท่านั้น
          </div>
        </div>
      </div>
    </div>
  );
}
