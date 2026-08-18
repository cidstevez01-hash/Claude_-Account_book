---
name: Washi Ledger & Liquid Glass
colors:
  surface: '#fff8f5'
  surface-dim: '#e9d6cc'
  surface-bright: '#fff8f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff1ea'
  surface-container: '#fdeadf'
  surface-container-high: '#f8e5da'
  surface-container-highest: '#f2dfd4'
  on-surface: '#231a13'
  on-surface-variant: '#56423f'
  inverse-surface: '#392e27'
  inverse-on-surface: '#ffede4'
  outline: '#89726f'
  outline-variant: '#dcc0bc'
  surface-tint: '#9f4036'
  primary: '#9b3e34'
  on-primary: '#ffffff'
  primary-container: '#bb554a'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb4aa'
  secondary: '#48663e'
  on-secondary: '#ffffff'
  secondary-container: '#c9edba'
  on-secondary-container: '#4d6c44'
  tertiary: '#765700'
  on-tertiary: '#ffffff'
  tertiary-container: '#946f00'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad5'
  primary-fixed-dim: '#ffb4aa'
  on-primary-fixed: '#410001'
  on-primary-fixed-variant: '#7f2921'
  secondary-fixed: '#c9edba'
  secondary-fixed-dim: '#add09f'
  on-secondary-fixed: '#052103'
  on-secondary-fixed-variant: '#314e28'
  tertiary-fixed: '#ffdf9e'
  tertiary-fixed-dim: '#f2bf48'
  on-tertiary-fixed: '#261a00'
  on-tertiary-fixed-variant: '#5b4300'
  background: '#fff8f5'
  on-background: '#231a13'
  surface-variant: '#f2dfd4'
typography:
  hero-balance:
    fontFamily: Noto Serif SC
    fontSize: 38px
    fontWeight: '700'
    lineHeight: 42px
    letterSpacing: -0.5px
  input-amount:
    fontFamily: Noto Serif SC
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 38px
  headline-lg:
    fontFamily: Noto Serif SC
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Noto Serif SC
    fontSize: 19px
    fontWeight: '700'
    lineHeight: 24px
  stat-figure:
    fontFamily: Noto Serif SC
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 22px
  entry-amount:
    fontFamily: Noto Serif SC
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 20px
  body-lg:
    fontFamily: Noto Sans SC
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 21px
  body-md:
    fontFamily: Noto Sans SC
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Noto Sans SC
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 1px
  tab-label:
    fontFamily: Noto Sans SC
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 12px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  safe-bottom: 90px
---

## Brand & Style

The design system is a sophisticated fusion of **Japanese Artisanal Minimalism** and **Modern iOS Glassmorphism**. It is designed to transform the often-stressful task of financial tracking into a calming, tactile ritual. The brand personality is grounded, meticulous, and trustworthy, yet feels personal and "hand-crafted."

### Design Pillars:
- **Artisanal Tactility:** Emulating the physical sensation of a high-grade *Techo* (notebook). This is achieved through organic, asymmetric corner radii and dashed "ledger" lines that suggest a paper-and-ink heritage.
- **Glassmorphic Precision:** Modern digital utility is represented through floating "liquid glass" navigation and frosted surfaces. This provides a clear visual hierarchy where active tools hover above the static "paper" ledger.
- **Semantic Emotional Response:** Financial health is communicated through a specific palette—Sage Jade for growth/income and Vermilion Seal for activity/expense—evoking the authority of a traditional wax seal or ink stamp.

## Colors

The palette is divided into functional roles that prioritize legibility and emotional context.

### Semantic Meaning
- **Primary (Seal Red):** Used for expenses, primary call-to-actions, and the Floating Action Button. It represents the "active" signature of a transaction.
- **Secondary (Jade Green):** Used for income, positive balances, and success states. It represents growth and financial health.
- **Tertiary (Gold Accent):** Reserved for highlights, special alerts, or "washi tape" decorative elements that draw attention without creating alarm.

### Surface System
- The **Paper** color serves as the global canvas background, providing a warm, non-clinical foundation.
- The **Card** color is a brighter "bleached" paper tone used for interactive elements and containers to provide subtle lift.
- **Ink Soft** is used exclusively for metadata, timestamps, and secondary labels to maintain a clear typographic hierarchy against the primary **Neutral (Ink)** text.

## Typography

This system uses a pairing of a high-contrast Serif for data and a clean Sans-Serif for interface chrome.

### Implementation Rules:
- **Tabular Numerals:** All financial figures (Hero Balance, Entry Amount, Stat Figures) **must** use `font-variant-numeric: tabular-nums`. This ensures that decimals and digits align perfectly in vertical lists.
- **Editorial Serif:** Use `Noto Serif` for any element representing "Value" or "History."
- **Functional Sans:** Use `Noto Sans` for "Navigation," "Labels," and "Input Hints."
- **Letter Spacing:** Apply 1px tracking to `label-caps` to evoke the feel of traditional print typesetting.

## Layout & Spacing

The layout is optimized for single-handed mobile use with a focus on bottom-oriented interactions.

### Grid & Margins
- **Standard Margin:** A consistent 16px horizontal gutter is applied to the main viewport.
- **Max Width:** For larger devices, content is constrained to a 480px central container to maintain the "handheld ledger" feel.
- **Safe Zones:** A significant 90px bottom inset is required to clear the floating liquid-glass tab bar and the Floating Action Button.

### Spacing Rhythm
The system follows a 4px base increment. Use `16px (md)` for internal card padding and `12px (sm)` for vertical spacing between transaction items within a group.

## Elevation & Depth

Hierarchy is established through material differentiation rather than traditional heavy shadows.

### Elevation Levels:
1.  **Level 0 (The Paper):** The background canvas (`--paper`). Static and non-interactive.
2.  **Level 1 (The Ledger):** Transaction cards and lists. They use a subtle "Papercut" effect: a 2px solid bottom border (`--grid-line`) or a `0 2px 0` shadow to simulate the thickness of a page.
3.  **Level 2 (The Stamp):** Primary buttons and the FAB. These use a weighted shadow (`0 4px 0 var(--seal-soft)`) to feel "pressed" onto the page.
4.  **Level 3 (Liquid Glass):** Overlays, navigation bars, and modal sheets. These use `backdrop-filter: blur(10px)` and semi-transparent fills to appear as if they are floating above the ledger.

### Border Styles:
- Use **Dashed Borders** (`1.5px dashed`) for "container" logic—like the borders of a ledger card or the track of a segmented picker.
- Use **Solid Borders** (`1px`) for individual item separation.

## Shapes

The shape language is characterized by **Organic Asymmetry**, moving away from perfect geometric rounding to mimic hand-trimmed paper.

### Shape Rules:
- **Asymmetric Cards:** Use varied radii for main cards (e.g., `26px 12px 24px 12px`). This "wabi-sabi" approach makes the UI feel more human.
- **Alternating Items:** In transaction lists, alternate the "lean" of the corners between odd and even rows (e.g., `18px 8px` vs `8px 18px`).
- **Functional Capsules:** Elements that are purely digital (Tab bars, Toggle switches, FABs) remain perfectly symmetrical with pill-shaped `rounded-xl` or circular `50%` radii to distinguish them from the "paper" content.

## Components

### Buttons & FAB
- **Primary FAB:** A 58px circle in `seal-red`. On active state, it should scale to `0.94` to provide tactile feedback.
- **Pill Buttons:** Used for category selection, featuring a 1.5px border.

### The Ledger Card (Summary)
- Must include a "Washi Tape" decorative element (a small rotated rectangle of `tertiary_color`) in the top corner.
- Use dashed lines to separate the "Income" and "Expense" stats at the bottom of the card.

### Input Fields
- **Amount Input:** Borderless with a thick 2px bottom "ink" line. The currency symbol should be fixed in the `hero-balance` serif style.
- **Category Grid:** A 4-column layout of "tiles" with asymmetric corners. Selection is indicated by a fill of `seal-soft` and a 2px `seal` border.

### Navigation (Liquid Glass Tab Bar)
- A floating capsule with a `backdrop-filter`. 
- Use a **Liquid Bubble** indicator: a sliding background pill that moves behind the active icon, slightly distorting the background content to simulate a glass lens.

### List Items
- **Day Headers:** Use a small "Date Chip" (muted background) on the left and a summary amount on the right.
- **Transaction Rows:** Flex row with a circular icon anchor (38px). The icon should be a clean 2px stroke.