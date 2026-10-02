# STOCKSENSE — AI Inventory Management System
### Designed for Nowshera Shopping Mall (Khyber Pakhtunkhwa, Pakistan)

StockSense is an enterprise-grade AI Inventory Management SaaS application built for modern multi-category shopping malls. It features transactional inventory accounting, row-level locking, strict Role-Based Access Control (RBAC), multi-admin management, and an intelligent AI inventory copilot orchestrated through n8n and OpenRouter.

---

## 1. Key Capabilities & Architectural Highlights

- **Single Source of Truth**: Supabase PostgreSQL is the absolute authority for stock quantities, user roles, cost prices, and mutations.
- **Zero Fake Data Policy**: No synthetic or hardcoded products, movements, suppliers, or categories are bundled in the codebase. All records originate strictly from your real Supabase database or live user inputs.
- **Next.js & TypeScript Architecture**: Pre-configured with `next.config.js` and TypeScript types for instant export to VS Code and Next.js production deployments.
- **Strict Role-Based Access Control (RBAC)**:
  - **STAFF**: Can view permitted inventory, search products, record stock IN/OUT, record permitted adjustments, use AI copilot, and view profile. **Staff can NEVER view supplier cost prices, gross profit, or margin percentages**.
  - **MANAGER**: Full staff capabilities plus product registration, category & supplier creation, price management, and viewing financial margin statistics.
  - **ADMIN**: Full manager capabilities plus complete User Management (`/settings/users`), adding employees, activating/deactivating accounts, and granting or revoking Administrator access.
- **Zero Negative Inventory Guarantee**: Enforced by database `CHECK (quantity_on_hand >= 0)` constraints and atomic transactional RPC functions (`change_stock`, `prepare_stock_change`, `confirm_stock_change`).
- **2-Step AI Confirmation Workflow**: AI never directly mutates database records without an explicit visual confirmation card displaying:
  `Current Stock` ➔ `Requested (+/-)` ➔ `New Stock`, `Supplier`, and `Reason` with `[Cancel]` and `[Confirm]` actions protected by idempotency keys.
- **Resilient AI Failure Mode**: Normal inventory workflows (Stock IN, Stock OUT, adjustments, dashboard, search) continue running with 100% reliability even if n8n or the AI provider is offline.

---

## 2. Technology Stack

- **Frontend**: Next.js & React 19 + TypeScript + Tailwind CSS v4 + Lucide Icons + Motion
- **Database / Auth**: Supabase PostgreSQL + Supabase Auth + Row Level Security (RLS) + Stored RPC Procedures
- **AI Orchestration**: n8n Webhook Workflow + OpenRouter (Claude 3.5 Sonnet / GPT-4o) + Supabase database tools
- **Framework Support**: Next.js (`next.config.js`) & Vite bundler (`vite.config.ts`)

---

## 3. Directory Structure

```text
├── supabase-schema.sql          # Complete DDL: tables, views, RLS policies, RPC functions, seed data
├── n8n-workflow-template.json   # Exportable n8n workflow for OpenRouter AI agent & tool orchestration
├── .env.example                 # Browser-safe client environment variables
├── README.md                    # System architecture and setup documentation
├── index.html                   # HTML5 entrypoint with Plus Jakarta Sans & JetBrains Mono fonts
├── src/
│   ├── types/
│   │   └── inventory.ts         # TypeScript interfaces (Product, Profile, Movement, Request, Role)
│   ├── lib/
│   │   ├── supabase.ts          # Supabase client initializer and connection detector
│   │   ├── api.ts               # Core database API (RPC calls + transactional offline engine)
│   │   └── ai.ts                # AI copilot service, prompt injection filter, & n8n webhook caller
│   ├── context/
│   │   └── AuthContext.tsx      # Auth session, role security, and instant evaluation role switcher
│   ├── components/
│   │   ├── common/
│   │   │   ├── Badge.tsx        # Role, movement type, and stock level badges
│   │   │   ├── StatCard.tsx     # KPI metrics component
│   │   │   ├── ConfirmationModal.tsx # Accessible modal for sensitive actions & role changes
│   │   │   └── ConnectionModal.tsx   # Supabase & n8n live connection settings dialog
│   │   ├── layout/
│   │   │   ├── Navbar.tsx       # Mall header, role indicator, quick stock actions, profile menu
│   │   │   ├── Sidebar.tsx      # Multi-section navigation with live low-stock counter badge
│   │   │   └── AppLayout.tsx    # Responsive application shell
│   │   └── ai/
│   │       └── AIStockConfirmationCard.tsx # Visual 2-step confirmation card
│   └── pages/
│       ├── LoginPage.tsx        # (/login) Supabase auth + 1-click evaluation accounts
│       ├── DashboardPage.tsx    # (/dashboard) Real-time KPIs, financials, and recent audit logs
│       ├── ProductsPage.tsx     # (/products) Catalog, role-masked prices, product creation
│       ├── InventoryPage.tsx    # (/inventory) Live on-hand stock and quick action triggers
│       ├── StockInPage.tsx      # (/stock-in) Inbound receipt form with live math calculator
│       ├── StockOutPage.tsx     # (/stock-out) Outbound dispatch form with negative stock guard
│       ├── HistoryPage.tsx      # (/history) Immutable transactional movement ledger + CSV export
│       ├── LowStockPage.tsx     # (/low-stock) Reorder watchlist with deficit calculation
│       ├── AssistantPage.tsx    # (/assistant) AI inventory copilot chat interface
│       ├── SettingsPage.tsx     # (/settings) System configuration & RBAC matrix
│       ├── UsersPage.tsx        # (/settings/users) Multi-admin user and role management
│       └── ProfilePage.tsx      # (/profile) Employee account details & permissions
```

---

## 4. Quick Start & Local Setup

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env` or `.env.local`:
```bash
cp .env.example .env
```

Set your browser-safe client keys:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_N8N_AI_WEBHOOK_URL=https://your-n8n-instance.com/webhook/stocksense-ai-copilot
```

*(Note: You can also enter and test these credentials directly inside the running application via the **Database & n8n Config** modal!)*

### Step 3: Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Supabase Database Deployment

1. Create a project in [Supabase](https://supabase.com).
2. Open the **SQL Editor** in your Supabase dashboard.
3. Open `supabase-schema.sql` located in this project's root folder.
4. Copy the entire contents and click **Run**.
5. The script automatically creates:
   - Tables: `profiles`, `categories`, `suppliers`, `products`, `inventory`, `inventory_movements`, `stock_change_requests`, `audit_logs`, `idempotency_keys`
   - Secure Views: `products_staff_view` (strips cost price), `products_manager_view` (includes margin analytics)
   - Stored RPC Procedures: `change_stock`, `prepare_stock_change`, `confirm_stock_change`, `cancel_stock_change`, `create_product`, `update_product_prices`, `get_low_stock`, `change_user_role`, `set_user_active`
   - Seed catalog tailored for Nowshera Shopping Mall (Electronics, Fashion, Grocery, Home, Perfumes)

---

## 6. n8n AI Orchestration Workflow Setup

1. Open your self-hosted or cloud **n8n** workspace.
2. Click **Import from File** and select `n8n-workflow-template.json` from the root directory.
3. In the OpenRouter Chat Model node, connect your OpenRouter API credential (e.g. Anthropic Claude 3.5 Sonnet or OpenAI GPT-4o).
4. Activate the workflow and copy the **Production Webhook URL**.
5. Paste this URL into `VITE_N8N_AI_WEBHOOK_URL` or via the in-app **Settings** page.

---

## 7. Pre-Configured Evaluation Accounts

To test the application immediately without manually provisioning accounts, the login screen provides 1-click evaluation access:

| Name | Role | Email | Permissions |
|---|---|---|---|
| **Hussain Rabi** | `ADMIN` | `hussainrabi67@gmail.com` | Full system access, User Management, Price controls, Margins |
| **Zainab Bibi** | `MANAGER` | `zainab.bibi@nowsheramall.pk` | Stock operations, Product creation, Pricing, Margins |
| **Ahmad Shah** | `STAFF` | `ahmad.shah@nowsheramall.pk` | Stock IN/OUT, Catalog view (**Cost price & margins strictly hidden**) |

---

## 8. Build Verification

To verify production bundle compilation:
```bash
npm run build
```
This generates optimized static production assets in the `dist` directory.
