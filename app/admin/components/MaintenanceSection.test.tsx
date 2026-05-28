import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MaintenanceSection from "./MaintenanceSection";
import type {
  AdminTranslate,
  MaintenanceLogEntry,
  MachineDirectoryItem,
  PlannedMaintenanceRecipient,
  PlannedMaintenanceItem,
} from "../adminShared";

vi.mock("react-modal", () => ({
  default: ({
    isOpen,
    children,
  }: {
    isOpen: boolean;
    children: React.ReactNode;
  }) => (isOpen ? <div data-testid="mock-modal">{children}</div> : null),
}));

const t: AdminTranslate = (key) => key;

const machineDirectory: MachineDirectoryItem[] = [
  {
    machineKey: "CUTTING::LINE-1",
    category: "CUTTING",
    subcategory: "LINE-1",
  },
];

const maintenanceItem: PlannedMaintenanceItem = {
  id: "maintenance-1",
  machineKey: "CUTTING::LINE-1",
  title: "Monthly inspection",
  dueDate: "2026-05-30T09:00:00.000Z",
  availabilityStartTime: "08:00",
  availabilityEndTime: "12:00",
  note: "Check belts",
  cost: 125,
  jiraIssueId: "10001",
  jiraIssueKey: "MECH-321",
  jiraIssueUrl: "https://svenheim.atlassian.net/browse/MECH-321",
  notificationRecipients: [],
  status: "planned",
  isCompleted: false,
  completedAt: null,
  createdBy: {
    id: "user-1",
    name: "Sven",
    email: "sven@example.com",
  },
  createdAt: "2026-05-01T08:00:00.000Z",
  updatedAt: "2026-05-02T08:00:00.000Z",
};

const baseProps = {
  locale: "en",
  t,
  plannedMaintenanceError: "",
  plannedMaintenanceSuccess: "",
  plannedMaintenanceLoading: false,
  plannedMaintenanceSaving: false,
  maintenanceCalendarLabel: "May 2026",
  maintenanceCalendarMonthItemCount: 1,
  maintenanceWeekdayLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  maintenanceCalendarDays: [
    {
      dateKey: "2026-05-30",
      dayNumber: 30,
      isCurrentMonth: true,
      isToday: false,
      isPlaceholder: false,
      items: [maintenanceItem],
    },
  ],
  selectedMaintenanceDate: "2026-05-30",
  maintenanceLogEntries: [] as MaintenanceLogEntry[],
  editingMaintenanceId: maintenanceItem.id,
  isMaintenanceModalOpen: true,
  isMaintenanceEditing: true,
  activeMaintenanceItem: maintenanceItem,
  activeMaintenanceStatus: "upcoming" as const,
  currentUserLabel: "Sven",
  machineDirectory,
  machineLabelByKey: {
    "CUTTING::LINE-1": "CUTTING / LINE-1",
  },
  maintenanceMachineKey: "CUTTING::LINE-1",
  maintenanceTitle: "Monthly inspection",
  maintenanceDueDate: "2026-05-30",
  maintenanceAvailabilityStartTime: "08:00",
  maintenanceAvailabilityEndTime: "12:00",
  maintenanceCost: "125",
  maintenanceNote: "Check belts",
  maintenanceNotificationRecipients: [] as PlannedMaintenanceRecipient[],
  selectedMaintenanceDateLabel: "Saturday, May 30, 2026",
  maintenanceActionKey: null,
  onPreviousMonth: vi.fn(),
  onThisMonth: vi.fn(),
  onNextMonth: vi.fn(),
  onOpenCreateMaintenanceModal: vi.fn(),
  onOpenEditMaintenanceModal: vi.fn(),
  onCloseMaintenanceModal: vi.fn(),
  onMaintenanceMachineKeyChange: vi.fn(),
  onMaintenanceTitleChange: vi.fn(),
  onMaintenanceDueDateChange: vi.fn(),
  onMaintenanceAvailabilityStartTimeChange: vi.fn(),
  onMaintenanceAvailabilityEndTimeChange: vi.fn(),
  onMaintenanceCostChange: vi.fn(),
  onMaintenanceNoteChange: vi.fn(),
  onMaintenanceNotificationRecipientsChange: vi.fn(),
  onSavePlannedMaintenance: vi.fn(),
  onUpdatePlannedMaintenanceStatus: vi.fn(),
  onSendPlannedMaintenanceReminder: vi.fn(),
  onDeletePlannedMaintenance: vi.fn(),
};

describe("MaintenanceSection", () => {
  it("shows the Jira link in the modal for linked maintenance items", () => {
    render(<MaintenanceSection {...baseProps} />);

    const jiraLink = screen.getByRole("link", { name: "admin.openInJira" });
    expect(jiraLink).toBeInTheDocument();
    expect(jiraLink).toHaveAttribute(
      "href",
      "https://svenheim.atlassian.net/browse/MECH-321",
    );
  });

  it("does not show the Jira link when the maintenance item is not linked", () => {
    render(
      <MaintenanceSection
        {...baseProps}
        activeMaintenanceItem={{
          ...maintenanceItem,
          jiraIssueId: null,
          jiraIssueKey: null,
          jiraIssueUrl: null,
        }}
      />,
    );

    expect(
      screen.queryByRole("link", { name: "admin.openInJira" }),
    ).not.toBeInTheDocument();
  });

  it("shows the maintenance creator in the modal", () => {
    render(<MaintenanceSection {...baseProps} />);

    expect(screen.getByText("admin.maintenanceCreatedBy")).toBeInTheDocument();
    expect(screen.getByText("Sven")).toBeInTheDocument();
  });

  it("shows the scheduled hours in the calendar card", () => {
    render(<MaintenanceSection {...baseProps} />);

    expect(screen.getByText("08:00-12:00")).toBeInTheDocument();
  });
});
