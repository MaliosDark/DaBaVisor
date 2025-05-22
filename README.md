
# Real-Time Data Flow Visualizer

![Status: Active](https://img.shields.io/badge/Status-Active-brightgreen)
![Node.js v16+](https://img.shields.io/badge/Node.js-v16+-green)
![Mermaid v10](https://img.shields.io/badge/Mermaid-v10-blue)

The **Real-Time Data Flow Visualizer** is a powerful web application designed to visualize data flows and structures across multiple databases (SQLite, MySQL, PostgreSQL, and Redis) in real time. Using Mermaid.js for rendering dynamic flowcharts, the application provides an intuitive interface to monitor database interactions, key updates, and table relationships. It leverages WebSocket communication via Socket.IO to deliver live updates, making it ideal for developers, database administrators, and system architects who need to observe and debug data flows in distributed systems.

## Table of Contents

- [Project Structure](#project-structure)
- [Features](#features)
- [Architecture](#architecture)
- [Mermaid Diagram: How It Works](#mermaid-diagram-how-it-works)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)



## Project Structure

```
flow-mermaid/
├── public/                   # Frontend assets
│   ├── index.html            # Main HTML with UI logic
│   └── style.css             # Optional additional styles
├── server/                   # Backend logic
│   ├── db/                   # Database connectors
│   │   ├── connections.js
│   │   └── index.js
│   ├── mermaidGenerator.js   # Diagram generator
│   └── socket.js             # Real-time update logic
├── app.js                    # Express server entry point
├── package.json              # Dependencies & metadata
└── README.md                 # This documentation
```


## Features

- **Real-Time Visualization**: Displays database structures and data flows in real time using Mermaid.js flowcharts.
- **Multi-Database Support**: Connects to SQLite, MySQL, PostgreSQL, and Redis, with extensible support for other databases.
- **Live Updates**: Uses Socket.IO for instant updates on database changes, such as Redis keyspace events or PostgreSQL `LISTEN/NOTIFY` triggers.
- **Interactive Interface**: Features a grid-based layout with clickable diagram cards that open detailed modal views.
- **Dynamic Styling**: Includes animated flow effects, glow updates, and responsive design for desktop and mobile.
- **Error Handling**: Robust handling of invalid diagram data with clear error messages and logging.
- **Extensible Architecture**: Modular design allows easy addition of new database types or visualization features.

## Architecture

The application is built using a client-server architecture with the following components:

- **Backend (Node.js/Express)**
  - **Express Server**: Serves the static frontend and provides a REST endpoint (`/diagram`) for fetching diagrams.
  - **Socket.IO**: Handles real-time communication, broadcasting database updates to connected clients.
  - **Mermaid Generator**: Queries databases to generate Mermaid flowchart syntax for tables (SQLite, MySQL, PostgreSQL) and key structures (Redis).
  - **Database Connectors**: Manages connections to SQLite, MySQL, PostgreSQL, and Redis, with support for live notifications (Redis keyspace events, PostgreSQL `LISTEN/NOTIFY`).
  - **Polling Fallback**: Refreshes diagrams every 5 seconds if live notifications are unavailable.

- **Frontend (HTML/CSS/JavaScript)**
  - **Mermaid.js**: Renders dynamic flowcharts from server-provided diagram data.
  - **Socket.IO Client**: Receives real-time updates and triggers diagram re-renders.
  - **Responsive UI**: Displays diagrams in a grid layout with interactive cards and a modal for detailed views.
  - **CSS Animations**: Enhances user experience with glowing effects, animated flows, and hover interactions.

- **Database Integration**
  - **SQLite/MySQL/PostgreSQL**: Visualizes table structures and column relationships.
  - **Redis**: Visualizes key hierarchies, including hash fields, lists, sets, and sorted sets.

## Mermaid Diagram: How It Works

```mermaid
graph TD
    A[Client Browser] -->|WebSocket| B[Socket.IO Client]
    B -->|Receives Updates| C[Frontend: index.html]
    C -->|Renders Diagrams| D[Mermaid.js]
    D -->|Displays| E[Diagram Cards]
    E -->|Click| F[Modal View]
    F -->|Renders Detailed Diagram| D

    G[Express Server] -->|Serves| C
    G -->|WebSocket| H[Socket.IO Server]
    H -->|Broadcasts Updates| B
    H -->|Triggers| I[Mermaid Generator]
    I -->|Queries| J[Database Connectors]
    J -->|Connects| K[SQLite]
    J -->|Connects| L[MySQL]
    J -->|Connects| M[PostgreSQL]
    J -->|Connects| N[Redis]

    N -->|Keyspace Events| O[Redis Listener]
    M -->|LISTEN/NOTIFY| P[PostgreSQL Listener]
    O -->|Notifies| H
    P -->|Notifies| H

    Q["Polling (5s)"] -->|Triggers| I

    subgraph Backend
        G
        H
        I
        J
        O
        P
        Q
    end

    subgraph Databases
        K
        L
        M
        N
    end

    subgraph Frontend
        A
        B
        C
        D
        E
        F
    end


````

## Prerequisites

* **Node.js** v16 or higher
* **npm** v8 or higher
* At least one database (SQLite, MySQL v8.0+, PostgreSQL v13+, Redis v6+)

## Installation

1. **Clone the repository**

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure databases**
   Edit `server/db/connections.js`:

   ```javascript
   module.exports = [
     {
       name: 'LocalSQLite',
       type: 'sqlite',
       path: './data.sqlite'
     },
     {
       name: 'RedisCache',
       type: 'redis',
       host: '127.0.0.1',
       port: 6379
     }
   ];
   ```

4. **Set up PostgreSQL notifications** (optional)

   ```sql
   CREATE OR REPLACE FUNCTION notify_table_update()
   RETURNS TRIGGER AS $$
   BEGIN
     PERFORM pg_notify('table_update', TG_TABLE_NAME || ':' || NEW.column_name);
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;

   CREATE TRIGGER users_update
   AFTER UPDATE ON users
   FOR EACH ROW EXECUTE FUNCTION notify_table_update();
   ```

5. **Enable Redis keyspace notifications** (optional)

   ```bash
   redis-cli CONFIG SET notify-keyspace-events KEA
   ```

## Usage

1. **Start the server**

   ```bash
   node app.js
   ```
2. **Visit** `http://localhost:3070` in your browser.
3. **Interact**: Click diagram cards to view details; watch real-time updates via glowing animations.

## Configuration

* **Database Connections**: `server/db/connections.js` (types: `sqlite`, `mysql`, `postgres`, `redis`)
* **Mermaid Settings**: `public/index.html` → `mermaid.initialize({ theme: 'default' })`
* **Polling Interval**: `server/socket.js` → `setInterval(emitAll, 5000)`
* **Diagram Threshold**: `server/mermaidGenerator.js` → `SMALL_DIAGRAM_THRESHOLD`
---


