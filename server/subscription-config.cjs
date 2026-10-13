// Central subscription configuration for BillEase.
// Keep all subscription prices here so the backend and payment integration use the same values.
const TRIAL_DURATION_MONTHS = 1;
const CURRENCY = "INR";

const SUBSCRIPTION_PLANS = Object.freeze({
  monthly: Object.freeze({
    id: "monthly",
    name: "Monthly",
    billingCycle: "monthly",
    amountInr: 249,
    amountPaise: 24900,
    currency: CURRENCY,
  }),
  annual: Object.freeze({
    id: "annual",
    name: "Annual",
    billingCycle: "annual",
    amountInr: 1999,
    amountPaise: 199900,
    currency: CURRENCY,
  }),
});

function addCalendarMonths(date, months) {
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDayOfTargetMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();
  result.setDate(Math.min(originalDay, lastDayOfTargetMonth));
  return result;
}

function getTrialEndDate(startDate = new Date()) {
  return addCalendarMonths(startDate, TRIAL_DURATION_MONTHS);
}

function getPublicSubscriptionPlans() {
  return {
    currency: CURRENCY,
    trial: { durationMonths: TRIAL_DURATION_MONTHS, priceInr: 0 },
    plans: Object.values(SUBSCRIPTION_PLANS).map((plan) => ({
      id: plan.id,
      name: plan.name,
      billingCycle: plan.billingCycle,
      amountInr: plan.amountInr,
      currency: plan.currency,
    })),
  };
}

module.exports = {
  CURRENCY,
  TRIAL_DURATION_MONTHS,
  SUBSCRIPTION_PLANS,
  addCalendarMonths,
  getTrialEndDate,
  getPublicSubscriptionPlans,
};
