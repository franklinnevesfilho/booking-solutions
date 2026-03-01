---
name: testing-qa
description: "Testing & QA: comprehensive guidance for unit, integration, and end-to-end testing, TDD, mocking, and testing infrastructure."
license: "See repository LICENSE"
---

# Testing & QA Practices

## Overview
Comprehensive guide for writing effective tests, following TDD practices, and ensuring code quality through automated testing.

## Language Neutrality Policy

This skill is language-agnostic. Apply the same testing principles to any stack.

- Examples in this document are illustrative, not prescriptive.
- Prefer the repository's existing test framework and conventions over example tools shown here.

## When to Use This Skill
- Writing unit, integration, or E2E tests
- Implementing test-driven development (TDD)
- Setting up testing infrastructure
- Debugging failing tests
- Improving test coverage
- Implementing mocking and stubbing strategies

## Testing Pyramid

### Unit Tests (Base - 70%)
**Purpose:** Test individual functions/methods in isolation
**Speed:** Very fast (milliseconds)
**Characteristics:**
- No external dependencies
- Test one thing at a time
- Should be deterministic
- Easy to write and maintain

### Integration Tests (Middle - 20%)
**Purpose:** Test how components work together
**Speed:** Moderate (seconds)
**Characteristics:**
- Test interactions between modules
- May use real database/APIs in test mode
- Test data flow between components

### E2E Tests (Top - 10%)
**Purpose:** Test complete user workflows
**Speed:** Slow (seconds to minutes)
**Characteristics:**
- Test from user's perspective
- Use real browser/environment
- Test critical user journeys only

## Unit Testing Best Practices

### 1. Test Structure (AAA Pattern)

### 2. Test Naming Convention
Use descriptive names that explain what, when, and expected result:

### 3. One Assertion Per Test (When Possible)

### 4. Test Edge Cases and Error Conditions

## Mocking & Stubbing

### When to Mock
- External APIs/services
- Database calls
- File system operations
- Time-dependent functions
- Third-party libraries

### Mock Types

#### 1. Function Mocks (Spies)

#### 2. Module Mocks

#### 3. Dependency Injection for Testability

## Testing Asynchronous Code

### Promises

### Callbacks

## Test-Driven Development (TDD)

### Red-Green-Refactor Cycle

**1. Red - Write a failing test**

**2. Green - Write minimal code to pass**

**3. Refactor - Improve code quality**

## Integration Testing

### Database Integration Tests

### API Integration Tests

## E2E Testing (Framework-agnostic)

1. **Test user journeys, not implementation**
2. **Use data-testid attributes** instead of CSS selectors
3. **Keep tests independent** - each test should work in isolation
4. **Clean up test data** after each test
5. **Test critical paths only** - E2E tests are expensive

## Code Coverage

### What to Aim For
- **Statements**: 80%+ coverage
- **Branches**: 75%+ coverage
- **Functions**: 80%+ coverage
- **Lines**: 80%+ coverage

### Coverage Commands (Examples by Ecosystem)
```bash
# JavaScript (Jest/Vitest)
npm test -- --coverage

# JavaScript: Generate HTML report
npm test -- --coverage --coverageReporters=html

# Python (pytest)
pytest --cov=. --cov-report=term-missing --cov-report=html

# Java (Maven + JaCoCo)
mvn test jacoco:report

# Java (Gradle + JaCoCo)
./gradlew test jacocoTestReport

# Go
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out -o coverage.html

# Rust
cargo test
# Optional coverage tooling depends on team standard (e.g., cargo-llvm-cov)
```

### Don't Chase 100% Coverage
- Focus on critical business logic
- Some code is hard/unnecessary to test (simple getters/setters)
- Test behavior, not implementation

## Common Testing Patterns

### 1. Test Fixtures (Reusable Test Data)

### 2. Factory Functions

### 3. Custom Matchers

## Testing Best Practices Checklist

- [ ] Tests are independent (can run in any order)
- [ ] Tests are fast (unit tests < 100ms each)
- [ ] Test names clearly describe what is being tested
- [ ] Each test focuses on one behavior
- [ ] Edge cases and error conditions are tested
- [ ] No hardcoded values (use constants/fixtures)
- [ ] Mocks are used appropriately (not over-mocked)
- [ ] Tests are maintainable (don't test implementation details)
- [ ] Critical code paths have high coverage
- [ ] E2E tests cover main user workflows

## Framework-Specific Resources

### JavaScript/TypeScript
- **Jest**: Unit/Integration testing
- **Vitest**: Fast Vite-native testing
- **Playwright**: E2E testing (recommended)
- **Cypress**: E2E testing (UI-focused)
- **Testing Library**: React/Vue component testing

### Python
- **pytest**: Unit/Integration testing
- **unittest**: Built-in testing
- **pytest-mock**: Mocking utilities
- **Selenium**: E2E testing

### Java
- **JUnit 5**: Unit testing
- **Mockito**: Mocking framework
- **TestContainers**: Integration testing with Docker
- **Selenium/Playwright**: E2E testing

### Go
- **testing**: Built-in unit testing
- **testify**: Assertions and mocks
- **httptest**: HTTP handler testing

### Rust
- **cargo test**: Unit and integration testing
- **proptest/quickcheck**: Property-based testing
- **mockall**: Mocking

### .NET
- **xUnit/NUnit/MSTest**: Unit/integration testing
- **Moq/NSubstitute**: Mocking
- **Playwright/Selenium**: E2E testing

## Common Pitfalls to Avoid

1. **Testing implementation details** - Test behavior, not internal structure
2. **Over-mocking** - Balance between isolation and realistic tests
3. **Flaky tests** - Tests that randomly fail (usually timing issues)
4. **Slow tests** - Keep unit tests fast
5. **Ignoring test maintenance** - Treat test code like production code
6. **Testing the framework** - Don't test library code, test your code
7. **No assertions** - Every test should have at least one assertion
