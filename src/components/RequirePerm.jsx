// frontend/src/components/RequirePerm.jsx
import React from "react";
import { Navigate } from "react-router-dom";

import {
  getPermissions,
  hasPerm,
} from "../utils/perms";

export default function RequirePerm({
  perm,
  children,
}) {
  const permissions = getPermissions();

  if (!hasPerm(permissions, perm)) {
    return (
      <Navigate
        to="/overview"
        replace
        state={{
          accessError:
            "You do not have permission to open that page.",
        }}
      />
    );
  }

  return children;
}
