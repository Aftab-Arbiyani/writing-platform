import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import {
  ALERT_CATEGORY,
  FAILURE_CLASS,
  INCIDENT_SEVERITY,
  INCIDENT_STATUS,
  type AlertCategory,
  type FailureClass,
  type IncidentSeverity,
  type IncidentStatus,
} from '../operations.constants';

const SEVERITIES = Object.values(INCIDENT_SEVERITY);
const STATUSES = Object.values(INCIDENT_STATUS);
const FAILURE_CLASSES = Object.values(FAILURE_CLASS);
const CATEGORIES = Object.values(ALERT_CATEGORY);

/** Open an incident (`POST /admin/operations/incidents`). */
export class OpenIncidentDto {
  @ApiProperty({ maxLength: 200, example: 'Elevated API 5xx errors' })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ enum: SEVERITIES, example: INCIDENT_SEVERITY.Sev2 })
  @IsIn(SEVERITIES)
  severity!: IncidentSeverity;

  @ApiPropertyOptional({ maxLength: 80, example: 'api' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  service?: string;
}

/** Transition an incident's status (`PATCH /admin/operations/incidents/:id/status`). */
export class TransitionIncidentDto {
  @ApiProperty({ enum: STATUSES, example: INCIDENT_STATUS.Investigating })
  @IsIn(STATUSES)
  status!: IncidentStatus;
}

/** Assign an incident (`PATCH /admin/operations/incidents/:id/assignee`). */
export class AssignIncidentDto {
  @ApiProperty({ example: 'a3f1…', description: 'Assignee user id.' })
  @IsString()
  @MaxLength(64)
  assigneeId!: string;
}

/** Add a note to an incident (`POST /admin/operations/incidents/:id/notes`). */
export class IncidentNoteDto {
  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  message!: string;
}

/** Resolve an incident (`POST /admin/operations/incidents/:id/resolve`). */
export class ResolveIncidentDto {
  @ApiProperty({ maxLength: 1000, example: 'AI provider timeout; failed over to secondary.' })
  @IsString()
  @MaxLength(1000)
  rootCause!: string;

  @ApiPropertyOptional({ enum: FAILURE_CLASSES, example: FAILURE_CLASS.Dependency })
  @IsOptional()
  @IsIn(FAILURE_CLASSES)
  failureClass?: FailureClass;
}

/** Set a feature rollout percentage (`PATCH /admin/operations/rollouts/:key/percentage`). */
export class SetRolloutPercentageDto {
  @ApiProperty({ minimum: 0, maximum: 100, example: 10 })
  @IsInt()
  @Min(0)
  @Max(100)
  percentage!: number;
}

/** Open a maintenance window (`POST /admin/operations/maintenance-windows`). */
export class OpenMaintenanceWindowDto {
  @ApiProperty({ maxLength: 200, example: 'Redis upgrade' })
  @IsString()
  @MaxLength(200)
  reason!: string;

  @ApiProperty({ minimum: 1, maximum: 1440, example: 30 })
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes!: number;

  @ApiPropertyOptional({ enum: CATEGORIES, isArray: true })
  @IsOptional()
  @IsIn(CATEGORIES, { each: true })
  categories?: AlertCategory[];
}

/** Record a deployment/change event (`POST /admin/operations/deployments`). */
export class RecordDeploymentDto {
  @ApiProperty({ enum: ['deployment', 'rollback', 'migration', 'config', 'infrastructure'] })
  @IsIn(['deployment', 'rollback', 'migration', 'config', 'infrastructure'])
  type!: 'deployment' | 'rollback' | 'migration' | 'config' | 'infrastructure';

  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  version?: string;

  @ApiPropertyOptional({ enum: ['succeeded', 'failed', 'in_progress'] })
  @IsOptional()
  @IsIn(['succeeded', 'failed', 'in_progress'])
  status?: 'succeeded' | 'failed' | 'in_progress';

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
