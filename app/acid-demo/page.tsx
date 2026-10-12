'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { AppLayout } from '@/components/layout/AppLayout';
import { addToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/utils';
import {
  Play,
  RotateCcw,
  Terminal,
  AlertTriangle,
  RefreshCw,
  Database,
} from 'lucide-react';

export default function AcidDemoPage() {
  const { user } = useAuth();

  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [stockAlerts, setStockAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [scenarioResult, setScenarioResult] = useState<any | null>(null);


  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/acid');
      const data = await res.json();
      if (res.ok) {
        setAuditLogs(data.auditLogs || []);
        setStockAlerts(data.stockAlerts || []);
      }
    } catch {
      addToast('Failed to load transaction logs', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  const runScenario = async (scenario: 'success' | 'oversell' | 'rollback') => {
    setRunningScenario(scenario);
    setScenarioResult(null);
    try {
      const res = await fetch('/api/acid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });
      const data = await res.json();
      setScenarioResult(data);
      if (data.status === 'SUCCESS') {
        addToast('Transaction committed', 'success');
      } else if (data.status === 'ROLLED_BACK') {
        addToast('Transaction rolled back: Atomicity preserved', 'warning');
      } else if (data.status === 'REJECTED') {
        addToast('Trigger prevented oversell: Consistency preserved', 'error');
      }
      loadData();
    } catch (err: any) {
      addToast(err.message || 'Error running scenario', 'error');
    } finally {
      setRunningScenario(null);
    }
  };



  return (
    <AppLayout>
      <div className="space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">
              Transaction demo
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Live ACID property verification and concurrency tests in PostgreSQL 16.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Database status dot moved here */}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-muted/50 border border-border text-xs text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>PostgreSQL 16: Connected</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadData}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* 4 Pillars Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-lg p-3.5">
            <span className="text-xs font-semibold text-foreground block mb-1">Atomicity</span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              All or nothing. If any single line item in an order fails stock verification, the entire order rolls back.
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3.5">
            <span className="text-xs font-semibold text-foreground block mb-1">Consistency</span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Schema constraints (<code className="font-mono text-foreground">CHECK &gt;= 0</code>) and triggers protect inventory balances.
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3.5">
            <span className="text-xs font-semibold text-foreground block mb-1">Isolation</span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Row-level locking (<code className="font-mono text-foreground">FOR UPDATE</code>) serializes concurrent POS checkouts.
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3.5">
            <span className="text-xs font-semibold text-foreground block mb-1">Durability</span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Committed records persist via Write-Ahead Logging (WAL) and immutable audit log entries.
            </p>
          </div>
        </div>

        {/* 3 Scenario Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Scenario 1 */}
          <div className="bg-card border border-border rounded-lg p-4 flex flex-col justify-between">
            <div>
              <span className="text-xs text-muted-foreground font-mono">Scenario 1</span>
              <h3 className="text-sm font-semibold text-foreground mt-0.5 mb-1.5">
                Atomic sale commit
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Executes a multi-table sale. Triggers automatically calculate subtotals, deduct stock, create payment, and update inventory in 1 atomic step.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              loading={runningScenario === 'success'}
              disabled={!!runningScenario}
              onClick={() => runScenario('success')}
              icon={<Play className="w-3.5 h-3.5" />}
            >
              Run atomic sale
            </Button>
          </div>

          {/* Scenario 2 */}
          <div className="bg-card border border-border rounded-lg p-4 flex flex-col justify-between">
            <div>
              <span className="text-xs text-muted-foreground font-mono">Scenario 2</span>
              <h3 className="text-sm font-semibold text-foreground mt-0.5 mb-1.5">
                Oversell prevention
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Attempts to purchase 200+ units beyond warehouse stock. Trigger catches negative stock violation and aborts transaction.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              loading={runningScenario === 'oversell'}
              disabled={!!runningScenario}
              onClick={() => runScenario('oversell')}
              icon={<AlertTriangle className="w-3.5 h-3.5" />}
            >
              Test oversell rejection
            </Button>
          </div>

          {/* Scenario 3 */}
          <div className="bg-card border border-border rounded-lg p-4 flex flex-col justify-between">
            <div>
              <span className="text-xs text-muted-foreground font-mono">Scenario 3</span>
              <h3 className="text-sm font-semibold text-foreground mt-0.5 mb-1.5">
                Multi-item rollback
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Cart contains Item 1 (Valid) and Item 2 (Exceeds stock). Proves Item 1 is NOT deducted when Item 2 fails. Stock remains untouched.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              loading={runningScenario === 'rollback'}
              disabled={!!runningScenario}
              onClick={() => runScenario('rollback')}
              icon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Test partial failure rollback
            </Button>
          </div>
        </div>

        {/* Live Scenario Result Box */}
        {scenarioResult && (
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-xs font-semibold text-foreground">
                  PostgreSQL transaction trace
                </h3>
              </div>
              <span
                className={`text-xs font-medium ${
                  scenarioResult.status === 'SUCCESS'
                    ? 'text-emerald-500'
                    : scenarioResult.status === 'ROLLED_BACK'
                    ? 'text-amber-500'
                    : 'text-rose-500'
                }`}
              >
                Status: {scenarioResult.status}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 rounded bg-muted/30 border border-border">
                <span className="text-muted-foreground block text-[11px]">Product</span>
                <span className="font-medium text-foreground truncate block mt-0.5">
                  {scenarioResult.productName}
                </span>
              </div>
              <div className="p-2.5 rounded bg-muted/30 border border-border">
                <span className="text-muted-foreground block text-[11px]">Stock before</span>
                <span className="font-mono text-foreground block mt-0.5 tabular-nums">
                  {scenarioResult.stockBefore} units
                </span>
              </div>
              <div className="p-2.5 rounded bg-muted/30 border border-border">
                <span className="text-muted-foreground block text-[11px]">Stock after</span>
                <span className="font-mono text-foreground block mt-0.5 tabular-nums">
                  {scenarioResult.stockAfter} units{' '}
                  {scenarioResult.stockAfter === scenarioResult.stockBefore ? '(Untouched)' : '(Updated)'}
                </span>
              </div>
            </div>

            <div className="rounded bg-muted/40 p-3 border border-border font-mono text-xs text-foreground overflow-x-auto">
              <pre className="text-muted-foreground text-[11px] whitespace-pre-wrap">{scenarioResult.sqlExecuted}</pre>
              {scenarioResult.errorMessage && (
                <p className="mt-2 text-rose-500 font-medium text-[11px]">
                  [PostgreSQL EXCEPTION]: {scenarioResult.errorMessage}
                </p>
              )}
            </div>

            <div className="text-xs text-muted-foreground leading-relaxed pt-1">
              <span className="font-medium text-foreground">Explanation: </span>
              {scenarioResult.explanation}
            </div>
          </div>
        )}

        {/* Telemetry: Audit Log and Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Audit Logs */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-xs font-semibold text-foreground mb-1">
              Audit log (audit_log table)
            </h3>
            <p className="text-xs text-muted-foreground mb-3">Immutable row-level change history</p>

            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {auditLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No logs recorded</p>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.log_id}
                    className="p-2 rounded bg-muted/20 border border-border text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-mono text-foreground font-medium">
                        #{log.log_id} {log.table_name}
                      </span>
                      <span className="text-muted-foreground text-[11px] block">
                        Record ID: {log.record_id} • By: {log.changed_by}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {log.action}
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        {formatDateTime(log.changed_at)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Trigger Alerts */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-xs font-semibold text-foreground mb-1">
              Trigger alerts (stock_alert table)
            </h3>
            <p className="text-xs text-muted-foreground mb-3">Automated threshold triggers</p>

            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {stockAlerts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No alerts recorded</p>
              ) : (
                stockAlerts.map((alt) => (
                  <div
                    key={alt.alert_id}
                    className="p-2 rounded bg-muted/20 border border-border text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-medium text-foreground block truncate max-w-[200px]">
                        {alt.product_name}
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        Quantity at alert: {alt.quantity_at_alert} (Reorder: {alt.reorder_level})
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-amber-500 font-medium">
                        {alt.status}
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        {formatDateTime(alt.alert_date)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
