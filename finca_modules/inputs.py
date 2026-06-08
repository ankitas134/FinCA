"""
inputs.py — User input & validation helpers
===========================================
All terminal input functions live here.
Each re-prompts until the value is valid — no crashes on bad input.
"""


def get_int_input(prompt, min_val=None, max_val=None):
    """Integer input with optional min/max bounds."""
    while True:
        try:
            val = int(input(prompt))
            if min_val is not None and val < min_val:
                print(f"    Must be at least {min_val}. Try again.")
                continue
            if max_val is not None and val > max_val:
                print(f"    Must be at most {max_val}. Try again.")
                continue
            return val
        except ValueError:
            print("    Please enter a whole number.")


def get_float_input(prompt, min_val=0.0, max_val=None):
    """Float input with optional min/max bounds."""
    while True:
        try:
            val = float(input(prompt))
            if val < min_val:
                print(f"    Must be {min_val} or more. Try again.")
                continue
            if max_val is not None and val > max_val:
                print(f"    Must be {max_val} or less. Try again.")
                continue
            return val
        except ValueError:
            print("    Please enter a valid number.")


def get_lifestyle_input():
    """Accepts frugal / average / lavish only."""
    valid = {"frugal", "average", "lavish"}
    while True:
        val = input("Lifestyle [frugal / average / lavish]: ").strip().lower()
        if val in valid:
            return val
        print("    Please type exactly: frugal, average, or lavish.")


def get_regime_input():
    """Accepts new / old tax regime."""
    while True:
        val = input("Tax regime [new / old]: ").strip().lower()
        if val in ("new", "old"):
            return val
        print("    Please type: new or old.")


def get_yes_no_input(prompt):
    """Accepts yes/y or no/n, returns bool."""
    while True:
        val = input(prompt).strip().lower()
        if val in ("yes", "y"):
            return True
        if val in ("no", "n"):
            return False
        print("    Please type: yes or no.")


def collect_user_inputs():
    """
    Collects all user inputs in one place and returns a dict.
    Keeps finca.py clean — one call instead of 15 scattered inputs.
    """
    name           = input("Your name: ").strip() or "Investor"
    age            = get_int_input("Your age: ", min_val=18, max_val=59)
    monthly_income = get_float_input("Monthly take-home income (Rs): ", min_val=1000)
    goal_amount    = get_float_input("Target retirement corpus (Rs): ", min_val=100_000)
    savings        = get_float_input("Existing savings / liquid investments (Rs): ", min_val=0)
    income_growth  = get_float_input(
        "Expected annual salary growth % (e.g. 8): ", min_val=0, max_val=50
    )

    print("\nTax regime:")
    print("  new = lower slabs, no 80C  |  old = allows ELSS/80C deductions")
    regime       = get_regime_input()
    health_issue = get_yes_no_input("Any major health condition? [yes/no]: ")

    print("\n--- Monthly Expenses ---")
    rent       = get_float_input("Rent / Home EMI (Rs): ", min_val=0)
    emi        = get_float_input("Other EMIs (Rs, 0 if none): ", min_val=0)
    groceries  = get_float_input("Groceries & food (Rs): ", min_val=0)
    utilities  = get_float_input("Bills, transport, subscriptions (Rs): ", min_val=0)
    dependents = get_int_input("Number of dependents: ", min_val=0, max_val=10)
    print("Lifestyle: frugal (5%) / average (10%) / lavish (20%) of income")
    lifestyle  = get_lifestyle_input()

    return {
        "name":          name,
        "age":           age,
        "monthly_income": monthly_income,
        "goal_amount":   goal_amount,
        "savings":       savings,
        "income_growth": income_growth,
        "regime":        regime,
        "health_issue":  health_issue,
        "rent":          rent,
        "emi":           emi,
        "groceries":     groceries,
        "utilities":     utilities,
        "dependents":    dependents,
        "lifestyle":     lifestyle,
    }


def collect_loan_inputs(surplus, get_float_fn=None, get_yes_no_fn=None):
    """
    Optionally collect high-interest loan details.
    Only loans above 12% interest are flagged for prioritisation.
    """
    get_float_fn   = get_float_fn   or get_float_input
    get_yes_no_fn  = get_yes_no_fn  or get_yes_no_input

    high_interest_loans = []
    print("\n--- Outstanding Loans (optional) ---")
    while True:
        if not get_yes_no_fn("Add a loan? [yes/no]: "):
            break
        loan_type = input("  Loan type: ").strip() or "Other"
        rate      = get_float_fn("  Interest rate %: ", min_val=0, max_val=60)
        loan_emi  = get_float_fn("  Monthly EMI (Rs): ", min_val=0)
        if rate > 12 and loan_emi > 0:
            high_interest_loans.append({"type": loan_type, "rate": rate, "emi": loan_emi})
            print(f"  {rate}% loan noted — will be prioritised over investing.")

    return high_interest_loans
