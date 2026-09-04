// frontend/src/components/RequirePlan.jsx
import React from "react";
import {
  Navigate,
  useLocation,
} from "react-router-dom";

import {
  getPlan,
  getPlanLabel,
  getRequiredPlanForPath,
  hasPlan,
  normalizePlan,
} from "../utils/perms";

export default function RequirePlan({
  plan,
  children,
}) {
  const location = useLocation();
  const currentPlan = getPlan();

  const requiredPlan = normalizePlan(
    plan ||
      getRequiredPlanForPath(location.pathname)
  );

  if (!hasPlan(requiredPlan, currentPlan)) {
    return (
      <Navigate
        to="/billing"
        replace
        state={{
          upgradeRequired: true,
          currentPlan,
          requiredPlan,
          requiredPlanLabel:
            getPlanLabel(requiredPlan),
          from: location.pathname,
        }}
      />
    );
  }

  return children;
}
