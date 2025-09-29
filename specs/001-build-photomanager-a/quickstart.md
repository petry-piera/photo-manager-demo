# PhotoManager Quickstart Guide

## Development Setup

### Prerequisites
- Node.js 18+ with npm
- Modern browser with File System Access API support
- Git for version control

### Installation
```bash
# Clone repository
git clone <repository-url>
cd photo-manager-petry

# Install dependencies
npm install

# Start development server
npm run dev
```

### Project Structure
```
src/
├── models/              # TypeScript interfaces and types
├── services/            # Business logic implementation
├── components/          # Reusable UI components
├── pages/               # Main application views
├── utils/               # Helper functions and utilities
├── styles/              # CSS and styling
└── main.ts              # Application entry point
```

## Quick Validation Tests

### 1. Application Launch Test
**Objective**: Verify the application starts and renders correctly

**Steps**:
1. Run `npm run dev`
2. Open http://localhost:5173 in browser
3. Verify main interface loads without errors
4. Check browser console for no error messages

**Expected Result**: Clean application interface with album grid view

### 2. File Import Test
**Objective**: Verify basic photo import functionality

**Steps**:
1. Click "Import Photos" button
2. Select 3-5 image files (JPEG/PNG)
3. Verify files are processed and thumbnails generated
4. Check that date-based albums are created automatically

**Expected Result**: Photos appear in appropriate date albums with thumbnails

### 3. Album Management Test
**Objective**: Verify album creation and organization

**Steps**:
1. Create a new custom album named "Test Album"
2. Drag photos from date albums to custom album
3. Verify photos appear in both locations
4. Rename the custom album to "My Test Album"

**Expected Result**: Album operations complete successfully with UI updates

### 4. Drag & Drop Test
**Objective**: Verify drag-and-drop functionality

**Steps**:
1. Open an album with multiple photos
2. Drag a photo to different position within album
3. Verify visual feedback during drag operation
4. Confirm photo position changes after drop

**Expected Result**: Smooth drag operation with immediate position update

### 5. Search Functionality Test
**Objective**: Verify search and filtering capabilities

**Steps**:
1. Add tags to several photos (e.g., "vacation", "family")
2. Use search bar to find photos by tag
3. Test date range search
4. Verify search results are accurate

**Expected Result**: Search returns correct photos matching criteria

### 6. Responsive Design Test
**Objective**: Verify mobile and desktop compatibility

**Steps**:
1. Test application on desktop browser
2. Resize browser window to mobile dimensions
3. Test touch gestures on mobile device
4. Verify all features work on both platforms

**Expected Result**: Consistent functionality across device types

## Performance Validation

### Load Test
**Objective**: Verify performance with larger photo collections

**Test Data**: 100+ photos of varying sizes
**Steps**:
1. Import batch of 100+ photos
2. Navigate between albums
3. Search through large collection
4. Monitor memory usage and response times

**Performance Targets**:
- Initial load: < 3 seconds
- Album navigation: < 500ms
- Search response: < 1 second
- Memory usage: < 500MB for 100 photos

### Stress Test
**Objective**: Test application limits and error handling

**Steps**:
1. Import very large images (>10MB)
2. Create albums with 1000+ photos
3. Test with corrupted image files
4. Test storage quota limits

**Expected Result**: Graceful error handling without crashes

## User Acceptance Scenarios

### Scenario 1: Family Photo Organization
**User Story**: Organize family vacation photos from phone
**Steps**:
1. Import 50+ photos from recent vacation
2. Verify automatic date organization
3. Create custom album "Summer Vacation 2025"
4. Add relevant photos to custom album
5. Tag photos with location names
6. Add captions to favorite photos

### Scenario 2: Professional Portfolio Management
**User Story**: Organize work portfolio photos
**Steps**:
1. Import professional photos from various shoots
2. Create custom albums for different clients
3. Tag photos by category (portrait, landscape, event)
4. Organize photos within albums by preference
5. Use search to quickly find specific photo types

### Scenario 3: Historical Photo Collection
**User Story**: Digitize and organize old family photos
**Steps**:
1. Import scanned historical photos (limited EXIF data)
2. Manually organize into custom date-based albums
3. Add detailed captions with family member names
4. Tag photos with family events and locations
5. Create backup of organized collection

## Troubleshooting Guide

### Common Issues

**Problem**: Photos not importing
- **Check**: File format support (JPEG, PNG, WEBP, HEIC)
- **Check**: Browser permissions for file access
- **Solution**: Try drag-and-drop import method

**Problem**: Slow performance with many photos
- **Check**: Browser memory usage
- **Solution**: Close other browser tabs, restart application

**Problem**: Albums not updating
- **Check**: Browser console for errors
- **Solution**: Refresh page, check IndexedDB storage

**Problem**: Search not finding photos
- **Check**: Tag spelling and formatting
- **Solution**: Use partial search terms, check date formats

### Browser Compatibility

**Supported Browsers**:
- Chrome 86+ (Full functionality)
- Firefox 82+ (Drag-and-drop import only)
- Safari 14+ (Limited File System Access)
- Edge 86+ (Full functionality)

**Fallback Features**:
- File input for browsers without File System Access API
- Drag-and-drop for alternative file import method

## Development Workflow

### Running Tests
```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e

# All tests
npm run test:all
```

### Building for Production
```bash
# Create production build
npm run build

# Preview production build
npm run preview

# Analyze bundle size
npm run analyze
```

### Code Quality
```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Format code
npm run format
```

## Configuration

### Environment Variables
- `VITE_MAX_FILE_SIZE`: Maximum photo file size (default: 50MB)
- `VITE_THUMBNAIL_SIZE`: Default thumbnail dimension (default: 200px)
- `VITE_CACHE_SIZE`: Maximum cache size (default: 100MB)

### Application Settings
Access via Settings panel in application:
- Theme selection (light/dark/system)
- Performance settings
- Import preferences
- Storage management

## Support and Documentation

### Additional Resources
- Feature specification: `spec.md`
- Implementation plan: `plan.md`
- Data model documentation: `data-model.md`
- Service contracts: `contracts/`

### Getting Help
1. Check browser console for error messages
2. Review troubleshooting guide above
3. Verify browser compatibility requirements
4. Test with minimal photo set first

## Next Steps
After successful quickstart validation:
1. Review full feature specification
2. Explore advanced features (batch operations, keyboard shortcuts)
3. Customize settings for optimal performance
4. Set up regular data backup routine