
// This file makes the Assign Task page available under the /admin route.
// It simply re-exports the component from the supervisor's assign-task page,
// as that component is now designed to handle both admin and supervisor roles correctly.

import AssignTaskPage from "@/app/dashboard/supervisor/assign-task/page";

export default AssignTaskPage;

    