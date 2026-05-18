# HR&GA E-Memo Requirements From `Book1.xlsx`

Source workbook: `D:\Hrproject\Book1.xlsx`

## Project

- Department: HR&GA
- Project: Develop an E-Memo document creation system and online approval workflow.
- Owner: นางสาวอำภา หิงคำ
- Rollout: Start with a few departments, then expand to all departments.
- Prototype phase: UI prototype only. Do not build database, authentication, email delivery, or live AI integration until the user approves the next phase.

## Confirmed User Clarifications

- The current phase is a prototype only.
- The system should eventually be usable by everyone in the company.
- Executives and high-level managers need special approval views or privileged windows.
- Approval behavior should follow the Excel workbook first.
- Gemini API from Google AI Studio may be considered for future AI draft/search work, but should remain optional and environment-driven.

## Pain Points

- Current memo documents are created manually in documents or Excel files.
- Paper printing, circulated signatures, scattered attachments, and separate file storage slow the process.
- Status tracking depends on asking people or forwarding documents.
- Manual storage makes historical search difficult.
- Business impact: repeated work, manual effort, long turnaround, and frequent errors.

## Expected Solution

- E-Memo Online.
- AI-assisted memo draft generation.
- Online workflow approval.
- Email notification for approval status.
- Dashboard for real-time document tracking.
- AI search for historical memos using keyword or document number.

## Business Value Targets

- Reduce memo creation and approval from 2-5 days to under 1 day or a few hours.
- Reduce annual cost by about 50,000-150,000 THB.
- Reduce manual errors by about 60%.
- Improve productivity by reducing manual follow-up and document handling.
- Improve tracking and historical document retrieval.

## Data Readiness

- Existing data sources: Excel, file server, email, paper documents, and internal systems.
- Historical data exists but is difficult to search because it is spread across formats.
- Data is sufficient to start an AI prototype and can be expanded later.
- Privacy is required because memo data may include approval and employee information.

## Approval Matrix Summary

- Follow `Book1.xlsx` as the source of truth before inventing new approval rules.
- General purchases and service contracts:
  - Up to 10,000 THB: Manager / Top Section.
  - 10,001-50,000 THB: General Manager.
  - Above 50,000 THB: Managing Director.
- Fixed assets:
  - Up to 100,000 THB in budget: General Manager.
  - Above 100,000 THB or out of budget: Managing Director.
- Over-budget or no-budget requests generally escalate to General Manager or Managing Director.
- Mold requests require MD approval every time.
- Price adjustments require MD review.

## Intern / Student Contribution

- Requirement collection and user interviews.
- Current process mapping.
- Data cleaning and basic data analysis.
- Prototype and dashboard development.
- Prompt engineering for AI memo drafting.
- Proof of concept rollout to 1-2 departments.
- Documentation, user training, testing, and feedback collection.

## Prototype Priorities

- Mid-term priority: 3-6 months.
- Ease of start: 3/3.
- Data readiness: 2/3.
- Business impact: 3/3.
- Suitable for intern prototype: 3/3.
