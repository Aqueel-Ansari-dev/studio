
import EmployeeTrainingPage from "../../employee/training/page";

// Supervisors see the same training library as employees.
// This component simply re-exports the employee page for this route.
export default function SupervisorTrainingPage() {
  return <EmployeeTrainingPage />;
}
