# NEIS MATE

A comprehensive memo application built with React, Vite, TypeScript, TailwindCSS, and shadcn/ui. The app supports multiple user modes and integrates with Google Drive for cloud storage.

## Features

### Authentication & User Modes
- **Google OAuth 2.0 integration** for secure login
- **Three user modes**:
  - **일반 (General)**: Free folder creation and memo organization
  - **학생 (Student)**: Grade and subject-based organization
  - **교사 (Teacher)**: Year, grade, subject, and student-based organization
- **Local storage fallback** for non-logged users (single memo)

### Core Functionality
- **Real-time word count**: Words, characters (with/without spaces)
- **Dark/Light mode**: Automatic system preference detection
- **Sidebar navigation** with search and sorting options
- **File management**: Create, edit, delete, duplicate, version control
- **Download capabilities**: Individual files (.txt) or entire collection (.zip)

### Mode-Specific Features

#### 일반 (General) Mode
- Custom folder structure with nesting support
- Free-form memo titles
- Folder organization with drag-and-drop (planned)
- Version control with numbered suffixes

#### 학생 (Student) Mode
- Automatic organization by grade (초1-고3)
- Subject-based categorization
- Version management (subject-1, subject-2, etc.)
- No manual folder creation

#### 교사 (Teacher) Mode
- Hierarchical organization: Year > Grade > Subject > Student
- Year selection (2021-2025)
- Grade selection (초1-고3)
- Student-specific memo management
- Version control per student

### Data Management
- **Google Drive integration** for cloud storage
- **Local storage** for offline access
- **Export functionality**: Download all notes maintaining folder structure
- **Data reset** capability
- **Mode switching** with data conversion

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS + CSS Variables
- **UI Components**: shadcn/ui (Radix UI primitives)
- **State Management**: Zustand with persistence
- **Icons**: Lucide React
- **Cloud Storage**: Google Drive API
- **File Processing**: JSZip for batch downloads

## Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd nice-notes
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Build for production**
   ```bash
   npm run build
   ```

## Development

The application is built with modern React patterns and TypeScript for type safety. Key features include:

- Mode-based memo organization (일반/학생/교사)
- Real-time word counting and character analysis
- Dark/light theme with system preference detection
- Google Drive integration for cloud storage
- Local storage fallback for offline use
- Comprehensive file management with versioning
- Batch download with folder structure preservation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License
