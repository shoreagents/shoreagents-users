# ShoreAgents Dashboard - Electron App

A desktop application for managing support tickets, built with Next.js and Electron.

## Features

- 🎫 Create and manage support tickets
- 📊 Dashboard with ticket statistics
- 🎨 Modern UI with ShoreAgents branding
- 💾 Local storage for ticket data
- 🔍 Search and filter tickets
- 📱 Responsive design

## Development

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
npm install
```

### Running the App

#### Development Mode
```bash
# Start the development server and Electron app
npm run electron-dev
```

#### Production Mode
```bash
# Build the Next.js app
npm run build

# Start the Next.js production server
npm start

# In a separate terminal, start Electron and load the local server
npm run electron
```

- By default, Electron will load http://localhost:3000 in production mode.
- Make sure the Next.js server is running before starting Electron.

### Building for Distribution

To package the Electron app for distribution, you can use electron-builder. This will bundle the Next.js app and Electron together, but you may need to adjust the Electron main process to load the local server or a bundled static build, depending on your deployment needs.

```bash
# Build for current platform
npm run dist

# Build for all platforms
npm run electron-pack
```

The built application will be available in the `dist` folder.

## Project Structure

```
├── electron/           # Electron main process files
│   ├── main.js        # Main Electron process
│   └── preload.js     # Preload script for security
├── src/               # Next.js application
│   ├── app/          # App router pages
│   ├── components/   # React components
│   ├── hooks/        # Custom React hooks
│   ├── lib/          # Utility functions
│   └── types/        # TypeScript type definitions
├── public/           # Static assets
└── package.json      # Dependencies and scripts
```

## Available Scripts

- `npm run dev` - Start Next.js development server
- `npm run build` - Build Next.js app for production
- `npm run start` - Start Next.js production server
- `npm run electron` - Start Electron app (make sure Next.js server is running)
- `npm run electron-dev` - Start development with hot reload
- `npm run electron-pack` - Build for distribution
- `npm run dist` - Build for current platform
- `npm run lint` - Run ESLint

## Technologies Used

- **Next.js 15** - React framework
- **Electron 28** - Desktop app framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Radix UI** - Accessible components
- **Lucide React** - Icons

## Brand Colors

- Primary Green: #7EAC0B
- Secondary Green: #97BC34
- Accent Green: #C3DB63
- Accent Gray: #F5F5F5
- Font: Montserrat

## License

Private - ShoreAgents

## ESLint Configuration

If you still see the ESLint error about `@typescript-eslint`, you may need to install the plugin with:

```bash
npm install --save-dev @typescript-eslint/eslint-plugin @typescript-eslint/parser
```
