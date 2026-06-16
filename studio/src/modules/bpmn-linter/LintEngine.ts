import Linter from 'bpmnlint/lib/linter';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';

import { ProcessModelAnalyzer } from './rules/ProcessModelAnalyzer';
import {
  builtinRuleFactories,
  builtinRuleMetadata,
  customRuleFactories,
  postProcessingRuleFactories,
  profiles,
} from './rules/config';
import type {
  BpmnlintConfig,
  BpmnlintReport,
  BpmnlintResolver,
  FindingCounts,
  LintFinding,
  LintSeverity,
  ModdleDefinitions,
  RuleSeverityConfig,
} from './types';
import { mapToLintSeverity } from './types';

export class LintEngine {
  private activeProfile: string = 'bpmn-development';
  private findings: LintFinding[] = [];
  private ruleOverrides: Record<string, RuleSeverityConfig> = {};

  setProfile(profile: string): void {
    this.activeProfile = profile;
  }

  setRuleOverrides(overrides: Record<string, RuleSeverityConfig>): void {
    this.ruleOverrides = overrides;
  }

  getFindings(): LintFinding[] {
    return this.findings;
  }

  getCounts(): FindingCounts {
    let errors = 0;
    let warnings = 0;
    let infos = 0;
    for (const finding of this.findings) {
      if (finding.severity === 'error') {
        errors++;
      } else if (finding.severity === 'warning') {
        warnings++;
      } else {
        infos++;
      }
    }
    return { errors, warnings, infos };
  }

  clearFindings(): void {
    this.findings = [];
  }

  async lint(definitions: ModdleDefinitions, elementRegistry?: ElementRegistry): Promise<LintFinding[]> {
    const profileConfig = profiles[this.activeProfile];
    if (!profileConfig) {
      this.findings = [];
      return this.findings;
    }

    const effectiveRules = { ...profileConfig.rules };
    for (const [ruleId, severity] of Object.entries(this.ruleOverrides)) {
      if ((severity as string) !== 'default' && ruleId in effectiveRules) {
        effectiveRules[ruleId] = severity;
      }
    }

    const resolvedConfig = this.buildLinterConfig(effectiveRules);

    const linter = new Linter({ config: resolvedConfig, resolver: this.createResolver() });
    const rawResults = (await linter.lint(definitions)) as Record<string, BpmnlintReport[]>;

    const bpmnlintFindings = this.mapResults(rawResults, effectiveRules, elementRegistry);
    const analyzerFindings = this.runPostProcessingRules(definitions, effectiveRules, elementRegistry);

    this.findings = [...bpmnlintFindings, ...analyzerFindings];
    this.findings.sort((left, right) => severityOrder(left.severity) - severityOrder(right.severity));
    return this.findings;
  }

  private runPostProcessingRules(
    definitions: ModdleDefinitions,
    effectiveRules: Record<string, RuleSeverityConfig>,
    elementRegistry?: ElementRegistry,
  ): LintFinding[] {
    const activePostRules = Object.entries(postProcessingRuleFactories).filter(([ruleId]) => {
      const sev = effectiveRules[ruleId];
      return sev && sev !== 'off';
    });

    if (activePostRules.length === 0) {
      return [];
    }

    const analyzer = new ProcessModelAnalyzer(definitions);
    const findings: LintFinding[] = [];

    for (const [ruleId, checkFn] of activePostRules) {
      const configSeverity = effectiveRules[ruleId];
      const ruleFindings = checkFn(analyzer, configSeverity);

      for (const finding of ruleFindings) {
        if (finding.elementId && elementRegistry) {
          const shape = elementRegistry.get(finding.elementId);
          if (shape?.businessObject?.name && !finding.elementName) {
            finding.elementName = shape.businessObject.name;
          }
        }
        findings.push(finding);
      }
    }

    return findings;
  }

  private buildLinterConfig(rules: Record<string, RuleSeverityConfig>): BpmnlintConfig {
    const linterRules: Record<string, string | number> = {};

    for (const [ruleId, severity] of Object.entries(rules)) {
      if (severity === 'off') {
        continue;
      }

      if (ruleId in postProcessingRuleFactories) {
        continue;
      }

      const mappedSeverity = severity === 'info' ? 'warn' : severity;
      const isBuiltin = ruleId in builtinRuleFactories;
      const prefix = isBuiltin ? 'bpmnlint' : 'bifrost-forge-world';
      linterRules[`${prefix}/${ruleId}`] = mappedSeverity;
    }

    return { rules: linterRules };
  }

  /**
   * bpmnlint's Linter uses a resolver to load rule modules.
   * We provide a custom resolver that returns pre-imported factories
   * for both built-in bpmnlint rules and custom bifrost-forge-world rules.
   *
   * IMPORTANT: bpmnlint's parseRuleName applies prefixPackage() which
   * turns 'bifrost-forge-world' into 'bpmnlint-plugin-bifrost-forge-world'. The resolver
   * must match the *prefixed* package name that bpmnlint passes.
   */
  private createResolver(): BpmnlintResolver {
    return {
      resolveRule(pkg: string, ruleName: string) {
        if (pkg === 'bpmnlint') {
          return builtinRuleFactories[ruleName] ?? null;
        }
        if (pkg === 'bpmnlint-plugin-bifrost-forge-world') {
          return customRuleFactories[ruleName] ?? null;
        }
        return null;
      },
      resolveConfig(_pkg: string, _configName: string) {
        return null;
      },
    };
  }

  private mapResults(
    rawResults: Record<string, BpmnlintReport[]>,
    rules: Record<string, RuleSeverityConfig>,
    elementRegistry?: ElementRegistry,
  ): LintFinding[] {
    const mapped: LintFinding[] = [];

    for (const [qualifiedRuleId, reports] of Object.entries(rawResults)) {
      const ruleId = qualifiedRuleId.replace(/^(bpmnlint|bifrost-forge-world)\//, '');
      const configSeverity = rules[ruleId];
      if (!configSeverity || configSeverity === 'off') {
        continue;
      }

      const severity: LintSeverity = mapToLintSeverity(configSeverity);
      const metadata = builtinRuleMetadata[ruleId];

      for (const report of reports) {
        const elementId: string | null = report.id ?? null;
        let elementName: string | null = null;

        if (elementId && elementRegistry) {
          const shape = elementRegistry.get(elementId);
          elementName = shape?.businessObject?.name ?? null;
        }

        mapped.push({
          ruleId,
          severity,
          elementId,
          elementName,
          message: report.message ?? `Rule '${ruleId}' violated`,
          why: metadata?.why ?? '',
          suggestion: metadata?.suggestion ?? '',
          category: metadata?.category ?? 'structure',
        });
      }
    }

    return mapped;
  }
}

function severityOrder(severity: LintSeverity): number {
  switch (severity) {
    case 'error':
      return 0;
    case 'warning':
      return 1;
    case 'info':
      return 2;
  }
}
