import type { ApprovalLevel, ApprovalRecommendation, ApprovalRouteReview } from "@/lib/approval";
import type { UseCustomRouteResult } from "../_hooks/useCustomRoute";
import { RoutingCard } from "./RoutingCard";
import { CustomRouteCard } from "./CustomRouteCard";
import { CustomRouteReasonNote } from "./CustomRouteReasonNote";
import { ReadRecipientPicker } from "./ReadRecipientPicker";

type Props = {
  isFreeform: boolean;
  customRoute: UseCustomRouteResult;
  recommendation: ApprovalRecommendation;
  freeformCustomRouteRequiresReason: boolean;
  routeOverrideReason: string;
  onRouteOverrideReasonChange: (v: string) => void;
  effectiveApprover: ApprovalLevel;
  tierClass: string;
  isOverridden: boolean;
  effectiveIsDeadStock: boolean;
  skipGmStep: boolean;
  routeReview: ApprovalRouteReview;
  selectedRoute: ApprovalLevel[];
  onApproverChange: (v: ApprovalLevel) => void;
  onRoutingReset: () => void;
  onSkipGmChange: (v: boolean) => void;
  readRecipients: string[];
  onReadRecipientsChange: (v: string[]) => void;
};

/** The "Approver Routing" assistant tab pane — extracted out of page.tsx to
 *  stay under the 700-line guardrail once free-form's Book1 comparison note
 *  (F1) landed alongside the Book1/custom tabs. */
export function RoutingTabPane({
  isFreeform,
  customRoute,
  recommendation,
  freeformCustomRouteRequiresReason,
  routeOverrideReason,
  onRouteOverrideReasonChange,
  effectiveApprover,
  tierClass,
  isOverridden,
  effectiveIsDeadStock,
  skipGmStep,
  routeReview,
  selectedRoute,
  onApproverChange,
  onRoutingReset,
  onSkipGmChange,
  readRecipients,
  onReadRecipientsChange,
}: Props) {
  const routeSource = customRoute.routeSource;
  return (
    <>
      <div className="em-tabs em-route-source-tabs" role="tablist" aria-label="วิธีกำหนดผู้อนุมัติ">
        {!isFreeform && (
          <button
            type="button"
            role="tab"
            aria-selected={routeSource === "book1"}
            className={`em-tab ${routeSource === "book1" ? "active" : ""}`}
            onClick={() => customRoute.setRouteSource("book1")}
          >
            แนะนำตาม Book1
          </button>
        )}
        <button
          type="button"
          role="tab"
          aria-selected={routeSource === "custom"}
          className={`em-tab ${routeSource === "custom" ? "active" : ""}`}
          onClick={() => customRoute.setRouteSource("custom")}
        >
          Customize route เอง
        </button>
      </div>
      {routeSource === "custom" ? (
        <>
          <CustomRouteCard
            route={customRoute}
            notifyMD={recommendation.notifyMD}
            notifyMDReason={recommendation.notifyMDReason}
          />
          {/* Free-form only — standard mode's custom tab keeps its existing
              V2 behavior (no Book1 comparison shown, Ruling 14 / F1). */}
          {isFreeform && (
            <div style={{ marginTop: 12 }}>
              <CustomRouteReasonNote
                recommendedFinalApprover={recommendation.recommendedFinalApprover}
                recommendationReason={recommendation.reason}
                requiresReason={freeformCustomRouteRequiresReason}
                routeOverrideReason={routeOverrideReason}
                onRouteOverrideReasonChange={onRouteOverrideReasonChange}
              />
            </div>
          )}
        </>
      ) : (
        <RoutingCard
          effectiveApprover={effectiveApprover}
          tierClass={tierClass}
          isOverridden={isOverridden}
          effectiveIsDeadStock={effectiveIsDeadStock}
          skipGmStep={skipGmStep}
          routeOverrideReason={routeOverrideReason}
          routeReview={routeReview}
          recommendation={recommendation}
          flow={selectedRoute}
          onApproverChange={onApproverChange}
          onReset={onRoutingReset}
          onSkipGmChange={onSkipGmChange}
          onRouteOverrideReasonChange={onRouteOverrideReasonChange}
        />
      )}
      <div style={{
        marginTop: 12,
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-md)",
        padding: "12px 14px",
      }}>
        <div className="em-eyebrow" style={{ fontSize: 11, marginBottom: 8 }}>
          ผู้รับทราบ / Read Recipients
        </div>
        <div className="em-field">
          <ReadRecipientPicker
            value={readRecipients}
            onChange={onReadRecipientsChange}
          />
        </div>
      </div>
    </>
  );
}
