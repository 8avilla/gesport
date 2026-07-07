<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:typescript-agent-rules -->
## TypeScript Agent Rules

### 1. Code style and formatting

- **Line length**: Lines should not exceed **120 characters**.
- **Spacing**: Use 2 spaces for indentation.
- **Empty lines**: Use empty lines to separate logical blocks of code.
- **Braces**: Always use braces for single-line conditional statements, loops, and blocks to avoid ambiguity.

### 2. Naming conventions

- **Variables**: Use `camelCase` (e.g., `firstName`, `totalCount`).
- **Constants**: Use `UPPER_SNAKE_CASE` for global constants (e.g., `MAX_USERS`, `API_KEY`).
- **Classes/Interfaces**: Use `PascalCase` (e.g., `UserService`, `IConfig`).
- **Functions**: Use `camelCase` (e.g., `calculateTotal`, `getUserById`).
- **Enums**: Use `PascalCase` for the enum type and `UPPER_SNAKE_CASE` for enum members.

### 3. Type safety

- **Avoid `any` type**: Use specific types or `unknown` when the type is truly uncertain.
- **Non-null assertion operator (`!`)**: Use sparingly and only when you are certain that the value is not null or undefined.
- **Optional chaining (`?.`)**: Prefer optional chaining over nested conditional checks.
- **Nullish coalescing operator (`??`)**: Prefer `??` over `||` for default values when `0` or `false` are valid values.

### 4. Imports and exports

- **Single responsibility**: Each file should ideally export one main class, function, or type.
- **Alphabetical ordering**: Group imports by type (e.g., node modules, third-party libraries, local modules).
- **Relative paths**: Use relative paths for local imports (e.g., `./utils`, `../services`).
- **Namespace imports**: Use namespace imports (`import * as name from 'module'`) only when necessary.

### 5. Error handling

- **Specific error types**: Use custom error classes instead of generic `Error` objects.
- **Async errors**: Always `await` promises in `async` functions and wrap them in `try-catch` blocks when handling specific errors.
- **Throw early**: Throw errors as early as possible to fail fast.

### 6. Documentation

- **JSDoc comments**: Document all public functions, classes, and interfaces with JSDoc comments.
- **Parameter documentation**: Clearly describe each parameter and its type.
- **Return value**: Describe what the function returns and what errors it may throw.

### 7. Immutability

- **Prefer immutable data structures**: Use `const` for variables that should not be reassigned.
- **Use `readonly` modifier**: Use `readonly` modifier for object properties and array elements that should not be mutated.
- **Avoid side effects**: Functions should ideally be pure and free of side effects.

### 8. Performance

- **Avoid unnecessary computations**: Don't recompute values that can be computed once.
- **Lazy evaluation**: Use lazy evaluation when appropriate (e.g., for expensive operations).
- **Array methods**: Prefer functional array methods (`map`, `filter`, `reduce`) over traditional `for` loops when it improves readability, but be mindful of performance for very large arrays.

### 9. Testing

- **Unit tests**: Each component or module should have corresponding unit tests.
- **Test file naming**: Use `*.test.ts` or `*.spec.ts` naming convention.
- **Test structure**: Follow the Arrange-Act-Assert (AAA) pattern.

### 10. Project structure

- **Feature-based organization**: Group files by feature rather than by type.
- **Layered architecture**: Separate concerns into distinct layers (e.g., `components`, `services`, `utils`, `models`).
- **Index files**: Use `index.ts` files to export the public API of a module.

### 11. File organization

- **Component files**: Place related files (component, styles, tests) in a single directory.
- **Type files**: Place type definitions in a `types.ts` or `interfaces.ts` file within the same module.
- **Configuration files**: Place configuration files in a `config.ts` or `config.js` file.

### 12. Code quality

- **DRY principle**: Avoid code duplication.
- **KISS principle**: Keep it simple, stupid.
- **YAGNI principle**: You ain't gonna need this.
- **SOLID principles**: Adhere to SOLID principles for object-oriented design.

<!-- END:typescript-agent-rules -->
