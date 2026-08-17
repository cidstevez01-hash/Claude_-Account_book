# Washi Ledger & Liquid Glass - Icon Specification

This document details the icon style and library used in the Washi Ledger project.

## Icon Style
- **Library**: Google Material Symbols / Material Icons.
- **Variation**: Outlined or Rounded (to match the `ROUND_EIGHT` design system).
- **Stroke Weight**: Normal (400) or Light (300) to maintain the delicate, "hand-drawn on paper" aesthetic.
- **Primary Color**: `#d1665a` (Vintage Red) for active states.
- **Secondary Color**: `#85736d` (Muted Brown) for inactive/unselected states.

## Core Icon Map
Use these icon names with the Google Material Icons library:

| Function | Icon Name | Usage |
| :--- | :--- | :--- |
| **Home/Dashboard** | `home` or `grid_view` | Main navigation |
| **Wallet/Balance** | `account_balance_wallet` | Wallet overview |
| **History/Transactions** | `history` or `receipt_long` | Transaction list |
| **Analytics/Reports** | `analytics` or `bar_chart` | Statistics page |
| **Add Transaction** | `add_circle` or `edit_square` | Entry button |
| **Settings** | `settings` | App settings |
| **Exchange Rate** | `currency_exchange` | Currency converter |
| **Profile** | `person` or `account_circle` | User account |
| **Menu** | `menu` | Side drawer trigger |

## Implementation for Claude
To help Claude implement these icons, you can provide the following instructions:

1. **Import Material Icons**:
   Add this to the `<head>` of your HTML:
   `<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">`

2. **Usage Example**:
   `<span class="material-icons text-[#d1665a]">account_balance_wallet</span>`

3. **Styling Hint**:
   "Use Google Material Icons. For active navigation items, use color `#d1665a`. For inactive items, use `#85736d`. Ensure icons are sized appropriately (usually 24px) with enough breathing room."
