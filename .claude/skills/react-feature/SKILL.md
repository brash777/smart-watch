---
name: react-feature
description: Build frontend screens and components in apps/web (React, Tailwind, TanStack Query, i18n, mobile first, Instagram-like UX). Use when creating or changing UI.
---

# React features

## 1. Feature layout

```text
apps/web/src/features/<feature>/
├── pages/        # route-level screens, registered in the router in src/app
├── components/   # components used only by this feature
├── hooks/        # TanStack Query hooks and other feature hooks
└── api.ts        # API calls for this feature + its query keys
```

- `<feature>` is kebab-case: `spaces`, `snaps`, `compose`, `moments`, `feed`, `profile`.
- A component used by two or more features moves to `apps/web/src/components/`.
- File names are kebab-case and components PascalCase: `snap-card.tsx` exports `SnapCard`.

## 2. Step by step

1. Read the feature in `docs/PRODUCT.md` and its endpoints in `docs/api.md`.
2. Add the API calls and query keys in `api.ts`.
3. Wrap them in TanStack Query hooks in `hooks/`.
4. Build the components and pages, mobile first, with design tokens.
5. Add every text to `es.json`.
6. Handle the loading, empty and error states.
7. Check accessibility.
8. Write the tests and run lint, typecheck and tests.

## 3. Data

- There is one HTTP client: `src/lib/http.ts`. Its base URL comes from `import.meta.env.VITE_API_URL`. Components and hooks never call `fetch` directly.
- `api.ts` uses that client and the schemas and types from `packages/shared`. It unwraps `{ data, meta }` and turns `{ error: { code } }` into a typed error.
- Hooks: `useQuery` for reads, `useInfiniteQuery` for cursor-paginated lists (`meta.nextCursor`), `useMutation` for writes. After a mutation, invalidate the queries it affects.
- Query keys come from one factory per feature:

```ts
export const spaceKeys = {
  all: ['spaces'] as const,
  list: () => [...spaceKeys.all, 'list'] as const,
  detail: (spaceId: string) => [...spaceKeys.all, 'detail', spaceId] as const,
};
```

- Use optimistic updates where instant feedback matters (likes, follows) and roll them back on error.

## 4. Text and i18n

- Every visible text goes through `t('key')` from i18next, including `alt`, `aria-label`, `placeholder`, `title`, toasts and error messages. JSX contains no literal user-facing strings.
- Add every key to `apps/web/src/i18n/locales/es.json`, grouped by feature (`spaces.createForm.nameLabel`).
- Use interpolation and plurals instead of string concatenation: `t('snaps.count', { count })` with `count_one` and `count_other` keys.
- Format dates and numbers with `Intl`, using the active i18n language.
- API errors show `t('errors.<CODE>')`, with a generic fallback key for unknown codes.

## 5. Design tokens and Space modes

- Colors, spacing and radii (and shadows and typography) are tokens: CSS variables in `src/styles/tokens.css` (light and dark), exposed to Tailwind 4 with `@theme` (there is no `tailwind.config`). Tailwind's default palette, radii and fonts are turned off there, so only token classes exist. Components use token classes (`bg-surface`, `text-muted`, `rounded-card`), never raw hex colors or arbitrary values such as `bg-[#…]` or `p-[13px]`.
- Each Space mode (STUDY, WORK, CONTENT) has its color token, icon and label key defined in **one configuration file**: `src/config/modes.ts`. Components read from it; they never `switch` on the mode to pick colors or icons.
- For visual decisions (layout, typography, motion, overall look), use the `frontend-design` skill if it is installed.

## 6. Mobile first, Instagram-like

- Design for a phone screen first, then add `sm:`, `md:` and `lg:` styles for larger screens.
- Familiar patterns: bottom navigation with a prominent capture button, a full-screen camera, a horizontal row of Moments at the top of the feed and a full-screen Moment viewer.
- Gestures: swipe (between Moments, to close a viewer), double tap (like a Post), long press (quick actions or preview). Every gesture also has a visible button or menu alternative.
- Besides the normal content, every screen handles:
  - **loading**: skeletons shaped like the final layout;
  - **empty**: a short explanation and the main action (e.g. take the first snap);
  - **error**: a message and a retry action.
- Images load lazily inside boxes with a fixed aspect ratio, so the layout does not jump.

## 7. Accessibility

- Every image has `alt` text: the snap's AI alt text when there is one, otherwise a translated description.
- Every input has a `<label>` (visible or `sr-only`), and its error is linked with `aria-describedby`.
- Every interactive element has a visible focus style (`focus-visible`, from tokens). Never remove outlines without a replacement.
- Touch targets are at least 44 × 44 px (e.g. `min-h-11 min-w-11` with Tailwind's default spacing).
- Use semantic elements (`button`, `a`, `nav`, `main`, headings in order), never clickable `div`s.
- Respect `prefers-reduced-motion` and keep text contrast at WCAG AA.

## 8. Forms

- `react-hook-form` with `zodResolver` and the schemas from `packages/shared`, the same ones the API validates.
- Show each validation error next to its field as an i18n key: map Zod issues to keys and never show raw Zod messages.
- Disable the submit button while submitting and show API errors with `t('errors.<CODE>')`.

## 9. Tests

- Vitest with React Testing Library for components and hooks that have logic: the loading, empty and error states, form validation, optimistic updates.
- Mock the HTTP layer; tests never call the real API.

## 10. Checklist

- [ ] Code in `features/<feature>/{pages,components,hooks,api.ts}`; shared UI in `src/components/`.
- [ ] Data through TanStack Query hooks and `src/lib/http.ts`; base URL from `VITE_API_URL`.
- [ ] No literal UI text; every key is in `es.json`.
- [ ] Only tokens; mode colors and icons come from the single mode configuration file.
- [ ] Loading, empty and error states.
- [ ] Alt texts, labels, visible focus, 44 px touch targets, alternatives to gestures.
- [ ] Forms with react-hook-form and the shared Zod schemas.
- [ ] Tests, lint and typecheck pass.
