# GuardHub Dashboard 🖥️

GuardHub Dashboard is a premium, high-performance web portal designed for parents to monitor and manage the GuardHub ecosystem. Built with React and Vite, it offers a real-time overview of family safety with a sleek, cybersecurity-inspired aesthetic.

## 🚀 Features

- **Real-Time Telemetry**: Live feed of device activity and content censoring events.
- **Family Management**: Easily add and manage family members and their devices.
- **Device Control**: Monitor device heartbeat and status.
- **Premium Design**: Modern "Cybersecurity" look with glassmorphism, glowing accents, and smooth animations.
- **Dual Theme Support**: Switch between specialized Light and Dark modes.
- **Responsive Layout**: Fully optimized for desktop and mobile viewing.

## 🛠️ Tech Stack

- **Framework**: [React](https://reactjs.org/) (with [Vite](https://vitejs.dev/))
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **API Client**: Axios with specialized monitoring hooks.
- **Notifications**: React Hot Toast

## 📋 Prerequisites

- Node.js (v18+)
- npm or yarn
- Access to the [GuardHub Backend](https://github.com/SlaveGuard/guardhub-backend)

## ⚙️ Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/SlaveGuard/guardhub-dashboard.git
   cd guardhub-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory:
   ```env
   VITE_API_URL="http://localhost:3000/api/v1"
   ```

4. **Run the Dashboard**
   ```bash
   # Development mode
   npm run dev

   # Production build
   npm run build
   npm run preview
   ```

## 🛡️ License

GuardHub is proprietary software. All rights reserved.
