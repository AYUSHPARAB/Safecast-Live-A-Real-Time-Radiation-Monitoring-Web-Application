# Radiation Tracking Frontend

Frontend for the **Big Data – Radiation Tracking** project.

## Tech Stack

* React
* Vite
* React Leaflet
* Leaflet

## Prerequisites

* Node.js (v18 or newer recommended)
* npm

## Installation

```bash
npm install
```

## Run the Development Server

```bash
npm run dev
```

The application will be available at:

```
http://localhost:5173
```

## Current Status

* Interactive radiation map using Leaflet
* Mock sensor data
* Global statistics panel
* Recent alerts panel
* Dashboard UI

## Backend Integration

The frontend currently uses mock data.

To connect to the backend, edit:

```
src/services/api.js
```

and change:

```javascript
export const USE_MOCK = true;
```

to

```javascript
export const USE_MOCK = false;
```

Ensure the backend is running on the configured API URL.

## Project Structure

```
src/
├── components/
├── layouts/
├── pages/
├── services/
├── styles/
├── utils/
├── App.jsx
└── main.jsx
```
