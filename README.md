# FinCA – AI-Powered Personal Financial Advisor

FinCA is a data-driven financial planning system that generates personalized investment strategies based on an individual’s income, expenses, goals, and risk profile.

It combines financial modeling, real-world datasets, and probabilistic simulation to deliver realistic wealth projections and actionable insights.

---

## Overview

FinCA is designed to replicate the decision-making process of a financial advisor.  
It evaluates a user’s financial condition, identifies risks, and provides structured recommendations for long-term wealth creation.

---

## Core Capabilities

- **Financial Profiling**  
  Builds a detailed profile using income, expenses, lifestyle, and dependents  

- **Surplus & Expense Analysis**  
  Determines investable capacity with realistic cost adjustments  

- **Adaptive Asset Allocation**  
  Dynamically allocates across equity, gold, fixed income, and insurance based on:
  - Risk appetite  
  - Age  
  - Dependents  
  - Liabilities  

- **Retirement Planning Engine**  
  Projects long-term wealth using weighted returns derived from market data  

- **Monte Carlo Simulation**  
  Models uncertainty and produces probabilistic outcomes:
  - Downside scenario  
  - Median expectation  
  - Upside potential  

- **Inflation-Aware Forecasting**  
  Adjusts projections to reflect real purchasing power  

- **Education Cost Planning**  
  Estimates future education expenses using inflation-adjusted projections  

- **Emergency Fund Validation**  
  Ensures minimum financial safety buffer (6 months of expenses)  

- **Debt Prioritization Logic**  
  Flags high-interest liabilities and recommends repayment strategy  

- **Tax Optimization (Section 80C)**  
  Calculates potential tax savings through ELSS-linked investments  

- **Income Growth Simulation**  
  Projects corpus under increasing contribution scenarios  

---

## Tech Stack

- Python  
- SQLite  
- JSON  

---

## Project Structure
finca/
│── finca.db # Financial datasets (NIFTY, gold, FD, inflation)
│── main.py # Core application
│── finca_output.json # Generated financial report


---

## Execution

The application runs in an interactive CLI mode and generates a structured financial report along with a JSON export.

---

## Output

- Console-based financial analysis report  
- Machine-readable output file: `finca_output.json`  

---

## Design Approach

- Uses historical financial datasets (equity, gold, FD rates, inflation)  
- Applies compound growth and weighted return models  
- Incorporates stochastic simulation for realistic forecasting  
- Prioritizes practical financial decision-making over theoretical assumptions  

---

## Scope

This project is intended for demonstration, academic, and portfolio purposes.  
It is not open for external contributions.

---

## Author

Ankita S
