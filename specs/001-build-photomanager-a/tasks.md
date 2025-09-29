# Tasks: PhotoManager - Personal Photo Collection Organizer

**Input**: Design documents from `/specs/001-build-photomanager-a/`
**Prerequisites**: plan.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

## Execution Flow (main)
```
1. Load plan.md from feature directory ✓
   → Tech stack: TypeScript/Vite, IndexedDB, minimal dependencies
   → Structure: Single web application (frontend-only)
2. Load design documents ✓
   → data-model.md: 6 entities (Photo, Album, Tag, etc.)
   → contracts/: 3 services (PhotoService, AlbumService, StorageService)
   → research.md: Vite, ExifReader, SortableJS, Dexie.js decisions
3. Generate tasks by category ✓
4. Apply task rules ✓
5. Number tasks sequentially ✓
6. Generate dependency graph ✓
7. Create parallel execution examples ✓
8. Validate task completeness ✓
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
Based on plan.md single web application structure:
- **Source**: `src/` at repository root
- **Tests**: `tests/` at repository root
- **Public**: `public/` at repository root

---

## Phase 3.1: Setup & Infrastructure

- [x] **T001** Create project structure per implementation plan
  - Initialize Vite project with TypeScript
  - Create directory structure: `src/{models,services,components,pages,utils,styles}`, `tests/{unit,integration,e2e}`, `public/`
  - Configure tsconfig.json for strict mode and path aliases

- [x] **T002** Initialize package.json with core dependencies
  - Add Vite, TypeScript, and build tools
  - Add ExifReader (~15KB), SortableJS (~30KB), Dexie.js (~50KB)
  - Configure build scripts and development server

- [x] **T003** [P] Configure development tooling
  - Set up ESLint with TypeScript rules in `.eslintrc.js`
  - Configure Prettier formatting in `.prettierrc`
  - Add Vitest configuration in `vitest.config.ts`
  - Set up Playwright for E2E testing in `playwright.config.ts`

- [x] **T004** [P] Create base HTML structure in `public/index.html`
  - Add meta tags for responsive design and PWA
  - Include accessibility landmarks and ARIA attributes
  - Set up theme CSS custom properties

---

## Phase 3.2: Contract Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

- [x] **T005** [P] PhotoService contract test in `tests/unit/services/PhotoService.test.ts`
  - Test importPhotos(), getPhoto(), updatePhoto(), deletePhoto() interfaces
  - Mock file handles and EXIF data extraction
  - Verify error handling for PhotoImportError and PhotoNotFoundError

- [x] **T006** [P] AlbumService contract test in `tests/unit/services/AlbumService.test.ts`
  - Test createAlbum(), addPhotosToAlbum(), reorderPhotosInAlbum() interfaces
  - Mock album operations and photo management
  - Verify error handling for AlbumNotFoundError and AlbumNameConflictError

- [x] **T007** [P] StorageService contract test in `tests/unit/services/StorageService.test.ts`
  - Test initialize(), storePhoto(), queryPhotos(), getStorageStats() interfaces
  - Mock IndexedDB operations with fake data
  - Verify error handling for StorageError and StorageQuotaExceededError

- [x] **T008** [P] Integration test: Photo import workflow in `tests/integration/photo-import.test.ts`
  - Test complete flow: file selection → EXIF extraction → thumbnail generation → storage
  - Mock File System Access API and file handles
  - Verify automatic date album creation

- [x] **T009** [P] Integration test: Album management in `tests/integration/album-management.test.ts`
  - Test album creation, photo addition, drag-and-drop reordering
  - Verify custom vs date album behaviors
  - Test album deletion and photo preservation

- [x] **T010** [P] Integration test: Search functionality in `tests/integration/search.test.ts`
  - Test search by tags, date range, and captions
  - Verify search performance with large datasets
  - Test search result ranking and relevance

---

## Phase 3.3: Core Models & Data Layer (ONLY after tests are failing)

- [x] **T011** [P] Photo model in `src/models/Photo.ts`
  - Implement Photo interface from data model
  - Add validation rules for required fields
  - Include computed properties and helper methods

- [x] **T012** [P] Album model in `src/models/Album.ts`
  - Implement Album interface with date/custom types
  - Add validation for year/month constraints
  - Include photo count and layout methods

- [x] **T013** [P] Tag model in `src/models/Tag.ts`
  - Implement Tag interface with name normalization
  - Add color validation and display name handling
  - Include photo count tracking

- [x] **T014** [P] Layout models in `src/models/Layout.ts`
  - Implement AlbumLayout and PhotoLayout interfaces
  - Add grid configuration and sorting options
  - Include view mode settings

- [x] **T015** [P] AppSettings model in `src/models/AppSettings.ts`
  - Implement settings interface with defaults
  - Add theme, performance, and import preferences
  - Include validation for numeric limits

- [x] **T016** DatabaseService implementation in `src/services/DatabaseService.ts`
  - Set up Dexie.js with IndexedDB schema from data model
  - Implement object stores with indexes
  - Add migration and upgrade logic

---

## Phase 3.4: Core Services Implementation

- [ ] **T017** StorageService implementation in `src/services/StorageService.ts`
  - Implement all StorageService contract methods
  - Add transaction management and error handling
  - Include cleanup and optimization methods
  - Connect to DatabaseService for IndexedDB operations

- [ ] **T018** EXIF service in `src/services/ExifService.ts`
  - Integrate ExifReader library for metadata extraction
  - Implement date parsing with fallback to file creation date
  - Add camera and location data extraction
  - Handle corrupted or missing EXIF data gracefully

- [ ] **T019** File handling utilities in `src/utils/file-utils.ts`
  - Implement File System Access API with drag-and-drop fallback
  - Add file validation for supported formats (JPEG, PNG, WEBP, HEIC)
  - Include file size and permission checking
  - Add progress tracking for batch operations

- [ ] **T020** PhotoService implementation in `src/services/PhotoService.ts`
  - Implement all PhotoService contract methods
  - Integrate ExifService for metadata extraction
  - Add thumbnail generation using Canvas API
  - Connect to StorageService for persistence
  - Include batch import processing

- [ ] **T021** AlbumService implementation in `src/services/AlbumService.ts`
  - Implement all AlbumService contract methods
  - Add date album auto-creation logic
  - Implement photo organization and reordering
  - Connect to StorageService for persistence
  - Include album statistics calculation

---

## Phase 3.5: UI Foundation & Components

- [ ] **T022** [P] Base UI utilities in `src/utils/dom-utils.ts`
  - Add DOM manipulation helpers
  - Implement event delegation patterns
  - Include accessibility utilities (focus management, ARIA)
  - Add responsive design helpers

- [ ] **T023** [P] Image utilities in `src/utils/image-utils.ts`
  - Implement thumbnail generation with Canvas API
  - Add progressive loading utilities
  - Include image format detection and validation
  - Add memory management for large images

- [ ] **T024** [P] Global styles in `src/styles/globals.css`
  - Define CSS custom properties for theming
  - Add responsive grid utilities
  - Include accessibility focus styles
  - Set up dark/light theme variables

- [ ] **T025** [P] Component styles in `src/styles/components/`
  - Create modular CSS for album grid, photo grid, drag-drop
  - Add animation classes for interactions
  - Include mobile-specific touch styles
  - Add high contrast mode support

- [ ] **T026** [P] Grid layout component in `src/components/common/GridLayout.tsx`
  - Create responsive grid with configurable columns
  - Add virtual scrolling for large collections
  - Include intersection observer for lazy loading
  - Support both album and photo grid modes

- [ ] **T027** [P] Drag-and-drop component in `src/components/DragDrop/DragDropProvider.tsx`
  - Integrate SortableJS for drag-and-drop functionality
  - Add visual feedback during drag operations
  - Support multi-select drag operations
  - Include touch gesture support for mobile

---

## Phase 3.6: Feature Implementation

- [ ] **T028** Album grid component in `src/components/AlbumGrid/AlbumGrid.tsx`
  - Display album thumbnails with cover photos
  - Implement album reordering via drag-and-drop
  - Add album creation and deletion UI
  - Connect to AlbumService for data operations

- [ ] **T029** Photo grid component in `src/components/PhotoGrid/PhotoGrid.tsx`
  - Display photos with lazy-loaded thumbnails
  - Implement photo reordering within albums
  - Add multi-select functionality
  - Connect to PhotoService for data operations

- [ ] **T030** Photo import component in `src/components/PhotoImport/PhotoImportDialog.tsx`
  - Create file selection UI with drag-and-drop zone
  - Add import progress tracking and cancellation
  - Display EXIF data preview during import
  - Handle import errors and duplicate detection

- [ ] **T031** Search component in `src/components/Search/SearchBar.tsx`
  - Implement search by tags, dates, and captions
  - Add advanced search filters and date range picker
  - Include search suggestions and autocomplete
  - Connect to StorageService for query operations

- [ ] **T032** Photo detail modal in `src/components/PhotoView/PhotoModal.tsx`
  - Display full-resolution photos with metadata
  - Add caption and tag editing interface
  - Include photo navigation within album
  - Support keyboard shortcuts for navigation

---

## Phase 3.7: Page-Level Integration

- [ ] **T033** Home page in `src/pages/HomePage/HomePage.tsx`
  - Integrate AlbumGrid component
  - Add search and import functionality
  - Include album creation controls
  - Implement responsive layout for mobile/desktop

- [ ] **T034** Album view page in `src/pages/AlbumView/AlbumView.tsx`
  - Integrate PhotoGrid component
  - Add album-specific controls (rename, delete, reorder)
  - Include breadcrumb navigation
  - Support album statistics display

- [ ] **T035** Application shell in `src/components/AppShell/AppShell.tsx`
  - Create main navigation and layout structure
  - Add settings panel and theme switching
  - Include global error boundary
  - Implement accessibility features (skip links, focus management)

- [ ] **T036** Main application entry in `src/main.ts`
  - Initialize services and database connection
  - Set up global error handling
  - Add service worker registration for offline support
  - Include performance monitoring

---

## Phase 3.8: Advanced Features & Polish

- [ ] **T037** [P] Performance optimizations in `src/utils/performance-utils.ts`
  - Implement virtual scrolling optimizations
  - Add image loading prioritization
  - Include memory cleanup utilities
  - Add performance metrics collection

- [ ] **T038** [P] Accessibility improvements across components
  - Add comprehensive ARIA labels and descriptions
  - Implement keyboard navigation for all interactions
  - Include screen reader announcements for dynamic content
  - Add high contrast and reduced motion support

- [ ] **T039** [P] Error handling and recovery in `src/services/ErrorService.ts`
  - Create centralized error handling and logging
  - Add user-friendly error messages
  - Implement data recovery mechanisms
  - Include offline error handling

- [ ] **T040** [P] Settings management in `src/services/SettingsService.ts`
  - Implement settings persistence and synchronization
  - Add import/export preferences
  - Include performance tuning options
  - Add backup and restore functionality

---

## Phase 3.9: Testing & Validation

- [ ] **T041** [P] Unit tests for utilities in `tests/unit/utils/`
  - Test file handling, image processing, and DOM utilities
  - Add edge case testing for large files and corrupted data
  - Include performance regression tests
  - Test error conditions and recovery

- [ ] **T042** [P] Component testing in `tests/unit/components/`
  - Test all UI components with mock data
  - Add accessibility testing with axe-core
  - Include responsive design testing
  - Test drag-and-drop interactions

- [ ] **T043** [P] End-to-end testing in `tests/e2e/user-flows.spec.ts`
  - Test complete user workflows from quickstart guide
  - Add performance testing with Lighthouse
  - Include cross-browser compatibility testing
  - Test offline functionality and data persistence

- [ ] **T044** Performance validation per quickstart.md
  - Verify <100ms UI response times
  - Test with 1000+ photo collections
  - Validate memory usage stays under 2GB
  - Ensure thumbnail loading <200ms

- [ ] **T045** Accessibility compliance validation
  - Run axe-core automated testing
  - Perform manual keyboard navigation testing
  - Test with screen readers (NVDA, JAWS, VoiceOver)
  - Validate WCAG 2.1 AA compliance

---

## Dependencies

**Critical Path**:
- Setup (T001-T004) → Contract Tests (T005-T010) → Models (T011-T015) → Services (T016-T021) → UI (T022-T036) → Polish (T037-T045)

**Specific Dependencies**:
- T016 (DatabaseService) blocks T017 (StorageService)
- T017 (StorageService) blocks T020 (PhotoService) and T021 (AlbumService)
- T018 (ExifService) blocks T020 (PhotoService)
- T019 (File utils) blocks T030 (Photo import)
- T026 (GridLayout) blocks T028 (AlbumGrid) and T029 (PhotoGrid)
- T027 (DragDrop) blocks T028 and T029
- Services (T017-T021) block UI components (T028-T032)
- Components block pages (T033-T035)

**Parallel Groups**:
- Models T011-T015 can run together
- Contract tests T005-T010 can run together
- UI foundation T022-T027 can run together (after models/services)
- Polish tasks T037-T045 can run together (after core implementation)

---

## Parallel Execution Examples

### Phase 3.2 - All Contract Tests (after T004)
```bash
# Launch contract tests in parallel:
Task: "PhotoService contract test in tests/unit/services/PhotoService.test.ts"
Task: "AlbumService contract test in tests/unit/services/AlbumService.test.ts"
Task: "StorageService contract test in tests/unit/services/StorageService.test.ts"
Task: "Integration test: Photo import workflow in tests/integration/photo-import.test.ts"
Task: "Integration test: Album management in tests/integration/album-management.test.ts"
Task: "Integration test: Search functionality in tests/integration/search.test.ts"
```

### Phase 3.3 - All Model Creation (after tests fail)
```bash
# Launch model creation in parallel:
Task: "Photo model in src/models/Photo.ts"
Task: "Album model in src/models/Album.ts"
Task: "Tag model in src/models/Tag.ts"
Task: "Layout models in src/models/Layout.ts"
Task: "AppSettings model in src/models/AppSettings.ts"
```

### Phase 3.8 - Polish Tasks (after core implementation)
```bash
# Launch polish tasks in parallel:
Task: "Performance optimizations in src/utils/performance-utils.ts"
Task: "Accessibility improvements across components"
Task: "Error handling and recovery in src/services/ErrorService.ts"
Task: "Settings management in src/services/SettingsService.ts"
```

---

## Notes

- **[P] tasks** = different files, no dependencies, can run in parallel
- **Verify all tests fail** before implementing (T005-T010 before T011+)
- **Commit after each task** to track progress
- **Follow constitutional principles**: Privacy-first, performance targets, accessibility, quality
- **File paths are exact** - no ambiguity about where code goes
- **Each task is specific enough** for LLM completion without additional context

---

## Validation Checklist ✓

- [x] All contracts have corresponding tests (T005-T007)
- [x] All entities have model tasks (T011-T015)
- [x] All tests come before implementation (T005-T010 before T011+)
- [x] Parallel tasks truly independent (different files, no shared state)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Constitutional compliance built into tasks
- [x] Performance and accessibility requirements included
- [x] Complete coverage of functional requirements FR-001 through FR-019

**Total Tasks**: 45 tasks across 9 phases
**Estimated Duration**: 8-12 weeks with parallel execution
**Ready for**: Immediate execution with `/implement` or manual task completion