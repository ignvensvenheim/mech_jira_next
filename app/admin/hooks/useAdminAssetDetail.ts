"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { NormalizedIssue } from "@/lib/jira";
import {
  getIssueAssetParts,
  parseJson,
  type EquipmentDetailsResponse,
  type MachineDataResponse,
  type ManualCostEntry,
  type TicketFixCost,
} from "../adminShared";

type UseAdminAssetDetailArgs = {
  sessionResolved: boolean;
  currentUserIsAdmin: boolean;
  machineKey: string;
  allIssues: NormalizedIssue[];
  ticketsLoading: boolean;
};

export function useAdminAssetDetail({
  sessionResolved,
  currentUserIsAdmin,
  machineKey,
  allIssues,
  ticketsLoading,
}: UseAdminAssetDetailArgs) {
  const [manualEntries, setManualEntries] = useState<ManualCostEntry[]>([]);
  const [equipmentDetails, setEquipmentDetails] = useState<EquipmentDetailsResponse | null>(null);
  const [ticketCostsByIssue, setTicketCostsByIssue] = useState<Record<string, TicketFixCost>>({});
  const [assetDataLoading, setAssetDataLoading] = useState(false);
  const [assetDataError, setAssetDataError] = useState("");

  const assetIssues = useMemo(
    () => allIssues.filter((issue) => getIssueAssetParts(issue).machineKey === machineKey),
    [allIssues, machineKey]
  );

  const loadAssetData = useCallback(async () => {
    if (!sessionResolved || !currentUserIsAdmin || !machineKey) {
      setAssetDataLoading(false);
      setAssetDataError("");
      setManualEntries([]);
      setEquipmentDetails(null);
      setTicketCostsByIssue({});
      return;
    }

    setAssetDataLoading(true);
    setAssetDataError("");
    try {
      const requests: Promise<void>[] = [];

      requests.push(
        fetch(`/api/admin/machine-data?machineKey=${encodeURIComponent(machineKey)}`, {
          cache: "no-store",
        }).then(async (response) => {
          const data = await parseJson<MachineDataResponse>(response);
          setManualEntries(data.entries ?? []);
        })
      );

      requests.push(
        fetch(`/api/admin/equipment?machineKey=${encodeURIComponent(machineKey)}`, {
          cache: "no-store",
        }).then(async (response) => {
          const data = await parseJson<EquipmentDetailsResponse>(response);
          setEquipmentDetails(data);
        })
      );

      if (assetIssues.length > 0) {
        requests.push(
          fetch("/api/admin/ticket-costs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ issueKeys: assetIssues.map((issue) => issue.key) }),
          }).then(async (response) => {
            const data = await parseJson<{ items: TicketFixCost[] }>(response);
            setTicketCostsByIssue(
              Object.fromEntries(data.items.map((item) => [item.issueKey, item])) as Record<
                string,
                TicketFixCost
              >
            );
          })
        );
      } else {
        setTicketCostsByIssue({});
      }

      await Promise.all(requests);
    } catch (error) {
      setAssetDataError(String((error as Error).message || error));
      setManualEntries([]);
      setEquipmentDetails(null);
      setTicketCostsByIssue({});
    } finally {
      setAssetDataLoading(false);
    }
  }, [assetIssues, currentUserIsAdmin, machineKey, sessionResolved]);

  useEffect(() => {
    if (ticketsLoading) return;
    void loadAssetData();
  }, [loadAssetData, ticketsLoading]);

  const repairCostTotal = useMemo(
    () =>
      assetIssues.reduce((sum, issue) => sum + (ticketCostsByIssue[issue.key]?.amount ?? 0), 0),
    [assetIssues, ticketCostsByIssue]
  );
  const manualCostTotal = useMemo(
    () => manualEntries.reduce((sum, entry) => sum + entry.amount, 0),
    [manualEntries]
  );

  return {
    assetIssues,
    manualEntries,
    equipmentDetails,
    ticketCostsByIssue,
    assetDataLoading,
    assetDataError,
    repairCostTotal,
    manualCostTotal,
    reloadAssetData: loadAssetData,
  };
}
