# Sono Tracker Aswan

## نظام إدارة الأنشطة العائمة في أسوان

A comprehensive management system for tracking and managing floating activities in Aswan, built with Next.js. The system supports full Arabic and English localization with RTL layout.

---

## 🚀 Features

### Core Modules

- **📊 Dashboard** — Real-time statistics for technical jobs, completed tasks, and user counts
- **⚙️ Settings** — Manage floating unit types, sailing routes, accident types, maintenance types, inspection types, and nationalities
- **📋 Basic Data** — Manage governorates, parties & officials, owning companies, operating companies, tourist marinas, and floating units
- **🚢 Trips** — Track and manage floating unit trips
- **🔍 Inspection** — Environmental and safety inspection management
- **🛠️ Services** — Tourist marina licensing and service management
- **⚡ Operation** — Accident reporting and maintenance scheduling
- **📈 Reports** — Generate and export reports in PDF or Excel format
- **🔐 Permissions** — User, role, module, and page permission management
- **🆘 Emergency Alerts** — Floating draggable emergency panel for drowning, fire, grounding, and collision incidents

### Key Capabilities

- ✅ Multi-language support (Arabic / English) with full RTL layout
- ✅ Cookie-based authentication with access & refresh token management
- ✅ Automatic token refresh and session persistence
- ✅ Dark mode support
- ✅ Responsive design for all screen sizes
- ✅ PWA support with fullscreen mode
- ✅ File upload & attachment management (images, PDF, Word, Excel)
- ✅ In-browser file viewer for uploaded attachments
- ✅ Advanced data tables with sorting, filtering, search, and pagination
- ✅ Form validation with Zod schemas
- ✅ Toast notifications for user feedback
- ✅ Animated UI components with Framer Motion
- ✅ Role-based access control (Super Admin, Admin, regular users)
- ✅ Draggable & pinnable emergency bar with live clock

---

## 🛠️ Tech Stack

### Frontend

| Technology                      | Purpose                 |
| ------------------------------- | ----------------------- |
| **Next.js 14.2.7** (App Router) | Framework               |
| **TypeScript**                  | Language                |
| **React 18**                    | UI Library              |
| **Tailwind CSS**                | Styling                 |
| **shadcn/ui** (Radix UI)        | Component Library       |
| **Redux Toolkit**               | Global State Management |
| **React Hook Form + Zod**       | Forms & Validation      |
| **Framer Motion**               | Animations              |
| **Lucide React**                | Icons                   |
| **TanStack Table**              | Data Tables             |
| **next-intl**                   | Internationalization    |
| **Axios**                       | HTTP Client             |
| **date-fns**                    | Date Utilities          |
| **jsPDF + jspdf-autotable**     | PDF Generation          |
| **xlsx / xlsx-js-style**        | Excel Processing        |
| **html2canvas**                 | HTML to Canvas          |
| **mammoth**                     | Word Document Parsing   |
| **screenfull**                  | Fullscreen API          |

---

## 📋 Prerequisites

- Node.js 18+
- npm, yarn, pnpm, or bun

---

## 🚀 Getting Started

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd Front
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables — create a `.env` file:

```env
# Dashboard Title & Description
TITLE="Sono Tracker Aswan"
DESCRIPTION="Sono Tracker is a system for tracking and managing Floating Activities in Aswan"

# Backend API
BACK_END_DEV="http://localhost:57950/api/v1"
NEXT_PUBLIC_BACK_END="http://<your-server-ip>"

# Auth Cookie Names
ACCESS_TOKEN_COOKIE=Acc_Tok_Sono_Tracker
REFRESH_TOKEN_COOKIE=Ref_Tok_Sono_Tracker
REFRESH_GUDIE_COOKIE=Ref_Guid_Sono_Tracker

# Locale Cookie
NEXT_LOCALE=NEXT_LOCALE

# Default Reset Password
DEF_PASS=123456
```

4. Run the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Structure

```
src/
├── app/
│   └── [locale]/                  # Internationalized routes
│       ├── dashboard/             # Dashboard & statistics
│       ├── settings/              # Settings (floating unit types, routes, etc.)
│       ├── basic-data/            # Basic data management
│       ├── trips/                 # Trips management
│       ├── inspection/            # Environmental & safety inspection
│       ├── services/              # Marina licenses & services
│       ├── operation/             # Accidents & maintenance
│       ├── reports/               # Report generation
│       ├── permissions/           # Users, roles, modules, pages
│       └── account/               # User account management
├── components/
│   ├── auth/                      # Login form
│   ├── layout/                    # Navbar, footer, emergency bar, fullscreen
│   ├── ui/                        # shadcn/ui components
│   ├── modals/                    # Alert modals
│   ├── permissions/               # User & role management components
│   ├── organization/              # Organization management
│   ├── visitor/                   # Technical job (visitor) management
│   ├── report/                    # Report generation form
│   ├── settings/                  # Settings sub-components
│   ├── basic-data/                # Basic data sub-components
│   └── Shared/                    # Shared utility components
├── actions/                       # Server actions (API calls)
│   ├── auth/                      # Login, logout, token refresh
│   ├── user/                      # User CRUD
│   ├── role/                      # Role CRUD
│   ├── Organization/              # Organization CRUD
│   ├── technicalJob/              # Technical job CRUD & reports
│   ├── technicalJobType/          # Technical job type CRUD
│   ├── technicalJobCategory/      # Technical job categories
│   └── computerIssue/             # Computer issue service
├── redux/                         # Redux store, nav & user reducers
├── hooks/                         # Custom React hooks
├── lib/                           # Utilities (date options, file viewer, token helper)
├── schemas/                       # Zod validation schemas
├── providers/                     # Theme, toast, store providers
├── middleware.ts                  # next-intl middleware
└── messages/                      # i18n translation files (ar, en, fr, it)
```

---

## 🔐 Authentication

- Cookie-based authentication using **HTTP-only access tokens**
- Automatic token refresh via refresh token cookie
- User data (ID, role, job category) persisted in `localStorage`
- Role-based navigation: **Super Admin** sees the Permissions menu; others do not
- Middleware handles locale routing; auth redirects are handled client-side

---

## 🌐 Internationalization

The app supports multiple languages:

| Language         | Code |
| ---------------- | ---- |
| Arabic (default) | `ar` |
| English          | `en` |
| French           | `fr` |
| Italian          | `it` |

RTL layout is automatically applied for Arabic. Translation files are in `src/messages/`.

---

## 📱 Responsive Design

| Breakpoint       | Target  |
| ---------------- | ------- |
| `< 768px`        | Mobile  |
| `768px – 1023px` | Tablet  |
| `≥ 1024px`       | Desktop |

---

## 🆘 Emergency Panel

A floating draggable widget is always visible for emergency reporting:

- **بلاغ غرق** — Drowning alert
- **بلاغ حريق** — Fire alert
- **بلاغ شحوط** — Grounding alert
- **بلاغ اصطدام** — Collision alert

The panel includes a live Arabic clock/calendar, is draggable around the screen, and can be pinned to a fixed position. Position and pin state are persisted in `localStorage`.

---

## 📈 Reports

Reports can be generated for technical jobs with filters for date range and job type:

- **PDF** — Exported via server-side API
- **Excel** — Exported and optionally previewed in-browser with Arabic support via HTML conversion

---

## 🚢 Deployment

### Build for Production

```bash
npm run build
```

### Start Production Server

```bash
NODE_ENV=production node server.js
```

### IIS Deployment (Windows)

The project includes a `web.config` for IIS + iisnode deployment. The custom `server.js` handles request routing.

---

## 📝 Environment Variables Reference

| Variable               | Description                                   |
| ---------------------- | --------------------------------------------- |
| `TITLE`                | Dashboard title shown in browser tab          |
| `DESCRIPTION`          | Site description                              |
| `BACK_END_DEV`         | Backend API base URL (server-side)            |
| `NEXT_PUBLIC_BACK_END` | Backend base URL (client-side, for file URLs) |
| `ACCESS_TOKEN_COOKIE`  | Name of the HTTP-only access token cookie     |
| `REFRESH_TOKEN_COOKIE` | Name of the refresh token cookie              |
| `REFRESH_GUDIE_COOKIE` | Name of the refresh GUID cookie               |
| `NEXT_LOCALE`          | Name of the locale cookie                     |
| `DEF_PASS`             | Default password for new users                |

---

## 👥 Authors

Aswan Governorate — Information Systems & Digital Transformation Center

## 📄 License

This project is private and proprietary.
