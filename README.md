# Conviction

**Conviction** is a portfolio intelligence and investment research platform built for serious retail investors.

Rather than providing buy/sell recommendations, Conviction focuses on giving investors the tools needed to perform deep research, analyze portfolio performance, evaluate valuation assumptions, and make informed decisions independently.

This project is part of the **WormToDragon** repository and is being built using real-world software engineering architecture with long-term scalability in mind.

---

## Vision

Most investing platforms focus on execution or generic recommendations.

Conviction is designed to become:

> **An investment research workstation for serious investors**

The platform emphasizes:

* Portfolio intelligence
* Investment research tools
* Financial analysis
* Valuation modeling
* Tax-aware portfolio tracking
* Long-term investing decision support

The philosophy behind Conviction is:

> **Provide tools, not answers.**

Users control assumptions, research metrics, valuation inputs, and portfolio strategies.

---

## Core Features (V1)

### Portfolio Management

* Multiple portfolios support
* Brokerage and crypto account support
* Holdings aggregation across accounts
* Portfolio allocation analysis
* Benchmark comparison

### Research Platform

* Asset search
* Company financial analysis
* Market data integration
* Watchlists
* Asset comparison

### Investment Analysis

* DCA simulation
* Valuation calculators
* Intrinsic value modeling
* Adjustable assumptions
* Margin of safety calculations

### Transactions & Tax Tracking

* Manual transaction entry
* CSV import support
* Tax lot tracking
* FIFO cost basis (V1)
* Realized gain/loss analysis

### Dashboard

* Portfolio performance overview
* CAGR tracking
* Benchmark comparison
* Allocation visualization
* Holdings analytics

---

## Technology Stack

### Backend

* **Java**
* **Spring Boot**
* **Spring Security**
* **Spring Data JPA**
* **PostgreSQL**
* **Flyway**
* **Hibernate**

### Frontend

* **React**
* **TypeScript**
* **Vite**
* **Tailwind CSS**

### Database

* **PostgreSQL** (Production)
* **H2** (Development)

---

## Architecture Philosophy

Conviction is being built using:

### Domain-Driven Structure

Instead of organizing code by technical layer:

```text
controllers/
services/
repositories/
```

The application follows a domain-based architecture:

```text
auth/
portfolio/
account/
asset/
transaction/
holding/
marketdata/
tax/
valuation/
```

This improves:

* Scalability
* Maintainability
* Feature ownership
* Long-term growth

---

## Project Structure

```text
wormtodragon/
├── backend/
├── frontend/
├── docs/
│   ├── uml/
│   ├── wireframes/
│   └── planning/
└── README.md
```

---

## Current Development Status

### Phase 1 — Foundation (In Progress)

Completed:

* Project initialization
* Spring Boot backend setup
* Security configuration
* H2 development database
* JPA configuration
* User domain vertical slice
* DTO architecture pattern
* REST API foundation

Upcoming:

* Portfolio domain
* Account domain
* Transaction engine
* Market data integration

---

## Long-Term Roadmap

### Phase 1

Foundation & Authentication

### Phase 2

Portfolio Backbone

### Phase 3

Market Data Integration

### Phase 4

Financial Intelligence

### Phase 5

Valuation & Tax Engine

---

## Design Principles

Conviction prioritizes:

* **Real-world architecture**
* **Scalable system design**
* **Long-term maintainability**
* **Professional UI/UX**
* **Investor-first workflows**

The goal is not to build a quick prototype.

The goal is to build software that can realistically scale into a production-grade platform.

---

## Disclaimer

Conviction does **not provide financial advice**.

The platform provides tools for research, analysis, and portfolio management. All investment decisions remain the responsibility of the user.

Cacing Cacing Naga Naga