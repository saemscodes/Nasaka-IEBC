# Nasaka IEBC - Development Guide

## Prerequisites

### Required Software
- Node.js 18+ and npm
- Git
- Visual Studio Code (recommended)
- Android Studio (for Android builds)
- Xcode (for iOS builds, macOS only)

### Optional
- Supabase CLI
- Capacitor CLI
- Google Chrome (for PWA testing)

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/nasaka-iebc.git
cd nasaka-iebc

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 4. Start development server
npm run dev