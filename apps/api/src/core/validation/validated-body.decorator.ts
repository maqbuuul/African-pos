import { BadRequestException, Body, type PipeTransform } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { validate, type ValidationError } from 'class-validator'

// error.constraints only holds messages for the property the error object
// itself is attached to — a failure nested under @ValidateNested (an array
// item or a nested DTO) reports through error.children instead, with its own
// (possibly empty) constraints. A flat `errors.map(e => e.constraints)` misses
// those entirely, so a nested validation failure came back as a bare 400 with
// no message at all (found while sync-testing offline push operations).
const flattenConstraints = (errors: ValidationError[]): string[] =>
  errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...flattenConstraints(error.children ?? []),
  ])

// Nest's global ValidationPipe (main.ts) decides which DTO class to validate
// a @Body() against by reading `design:paramtypes` reflection metadata off
// the controller method. esbuild — tsx's transform, and every `dev` script
// in this monorepo runs on tsx — does not emit that metadata for method
// parameters, so the metatype Nest reads back is `undefined` and the global
// pipe's `toValidate()` guard skips validation entirely. That means every
// `@Body() dto: SomeDto` in this codebase was, until this fix, accepting
// malformed/missing bodies straight through to the service unvalidated (see
// project memory "critical DTO validation gap", found while verifying P4).
//
// This decorator sidesteps reflection altogether: the DTO class is passed
// explicitly, so validation runs identically whether the process is started
// via tsx, ts-node, or a compiled `tsc` build. Use
// `@ValidatedBody(SomeDto) dto: SomeDto` everywhere a body needs validating —
// never bare `@Body()`.
class ExplicitClassValidationPipe<T extends object> implements PipeTransform {
  constructor(private readonly dtoClass: new () => T) {}

  async transform(value: unknown): Promise<T> {
    const instance = plainToInstance(this.dtoClass, value ?? {})
    const errors = await validate(instance as object, { whitelist: true })
    if (errors.length > 0) {
      throw new BadRequestException(flattenConstraints(errors))
    }
    return instance
  }
}

export const ValidatedBody = <T extends object>(dtoClass: new () => T): ParameterDecorator =>
  Body(new ExplicitClassValidationPipe(dtoClass))
