"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getActiveDatePreset,
  getLastMonthRange,
  getLastSevenDaysRange,
  getLastSixMonthsRange,
  getThisMonthRange,
  type AdminFunction,
} from "../adminShared";

export function useAdminFilters(activeFunction: AdminFunction) {
  const defaultDateRange = useMemo(() => getLastSevenDaysRange(), []);
  const [costsCategory, setCostsCategory] = useState("");
  const [costsSubCategory, setCostsSubCategory] = useState("");
  const [statisticsCategory, setStatisticsCategory] = useState("");
  const [statisticsSubCategory, setStatisticsSubCategory] = useState("");
  const [costsDateFrom, setCostsDateFrom] = useState(defaultDateRange.from);
  const [costsDateTo, setCostsDateTo] = useState(defaultDateRange.to);
  const [statisticsDateFrom, setStatisticsDateFrom] = useState(defaultDateRange.from);
  const [statisticsDateTo, setStatisticsDateTo] = useState(defaultDateRange.to);
  const [costsCurrentPage, setCostsCurrentPage] = useState(1);

  const viewCategory = activeFunction === "statistics" ? statisticsCategory : costsCategory;
  const viewSubCategory =
    activeFunction === "statistics" ? statisticsSubCategory : costsSubCategory;
  const viewDateFrom = activeFunction === "statistics" ? statisticsDateFrom : costsDateFrom;
  const viewDateTo = activeFunction === "statistics" ? statisticsDateTo : costsDateTo;

  const costsActiveDatePreset = useMemo(
    () => getActiveDatePreset(costsDateFrom, costsDateTo),
    [costsDateFrom, costsDateTo]
  );
  const statisticsActiveDatePreset = useMemo(
    () => getActiveDatePreset(statisticsDateFrom, statisticsDateTo),
    [statisticsDateFrom, statisticsDateTo]
  );

  useEffect(() => {
    setCostsCurrentPage(1);
  }, [costsCategory, costsSubCategory, costsDateFrom, costsDateTo]);

  const resetCostsFilters = () => {
    setCostsCategory("");
    setCostsSubCategory("");
    setCostsDateFrom(defaultDateRange.from);
    setCostsDateTo(defaultDateRange.to);
  };

  const resetStatisticsFilters = () => {
    setStatisticsCategory("");
    setStatisticsSubCategory("");
    setStatisticsDateFrom(defaultDateRange.from);
    setStatisticsDateTo(defaultDateRange.to);
  };

  const setActiveViewDateRange = (from: string, to: string) => {
    if (activeFunction === "statistics") {
      setStatisticsDateFrom(from);
      setStatisticsDateTo(to);
      return;
    }

    setCostsDateFrom(from);
    setCostsDateTo(to);
  };

  const applyLastSevenDays = () => {
    setActiveViewDateRange(defaultDateRange.from, defaultDateRange.to);
  };

  const applyAllTickets = () => {
    setActiveViewDateRange("", "");
  };

  const applyThisMonth = () => {
    const range = getThisMonthRange();
    setActiveViewDateRange(range.from, range.to);
  };

  const applyLastMonth = () => {
    const range = getLastMonthRange();
    setActiveViewDateRange(range.from, range.to);
  };

  const applyLastSixMonths = () => {
    const range = getLastSixMonthsRange();
    setActiveViewDateRange(range.from, range.to);
  };

  return {
    defaultDateRange,
    costsCategory,
    setCostsCategory,
    costsSubCategory,
    setCostsSubCategory,
    statisticsCategory,
    setStatisticsCategory,
    statisticsSubCategory,
    setStatisticsSubCategory,
    costsDateFrom,
    setCostsDateFrom,
    costsDateTo,
    setCostsDateTo,
    statisticsDateFrom,
    setStatisticsDateFrom,
    statisticsDateTo,
    setStatisticsDateTo,
    viewCategory,
    viewSubCategory,
    viewDateFrom,
    viewDateTo,
    costsActiveDatePreset,
    statisticsActiveDatePreset,
    costsCurrentPage,
    setCostsCurrentPage,
    resetCostsFilters,
    resetStatisticsFilters,
    applyLastSevenDays,
    applyAllTickets,
    applyThisMonth,
    applyLastMonth,
    applyLastSixMonths,
  };
}
