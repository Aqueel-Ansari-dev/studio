# FieldOps MVP

FieldOps is a Next.js and Firebase based application for managing field operations. It provides role-based dashboards for employees, supervisors and administrators while leveraging AI to analyze tasks and attendance.

## Key Features

- **GPS‑based login** with location verification
- **Project selection** showing assigned projects
- **Task management** with start/stop timers
- **Task submission** including photo or video uploads
- **Automated attendance** tied to task activity
- **Supervisor dashboards** for assigning tasks
- **AI‑powered compliance checks** using uploaded media and GPS data
- **Training module** with simple course listings
- **Sales & billing** examples for administrators
- **Inventory and expense tracking**
- **Payroll processing** utilities
- **Notification system** for users by role

## AI Flows

Located in `src/ai/flows` are two Genkit flows:

- `attendance-anomaly-detection.ts` – analyzes attendance logs and GPS data for anomalies
- `compliance-risk-analysis.ts` – identifies compliance risks from uploaded media and location data

Run the AI dev server with:

```bash
npm run genkit:dev
```

## Development Scripts

- `npm run dev` – start the Next.js development server
- `npm run build` – create a production build
- `npm run start` – run the built app

## Style Highlights

FieldOps follows the design blueprint in `docs/blueprint.md`:

- Primary color dusty blue `#6B8ECA`
- Light gray background `#F0F0F0`
- Accent color muted orange `#D2691E`
- Mobile‑first layout with subtle animations
- Simple icons and the **PT Sans** font family

## Getting Started

Clone the repo and install dependencies:

```bash
npm install
```

Then run the dev server:

```bash
npm run dev
```

Login or sign up at `/` to access the dashboards. Start with `src/app/page.tsx` to explore the login logic.
