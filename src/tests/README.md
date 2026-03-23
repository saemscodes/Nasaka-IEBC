# Test Suite Documentation

This directory contains the comprehensive test suite for the Nasaka IEBC application.

## Structure

```
src/tests/
├── setup.ts              # Global test configuration and setup
├── api/                   # API endpoint tests
│   ├── offices.test.ts
│   ├── verification.test.ts
│   └── contributions.test.ts
├── components/            # Component tests
│   └── IEBCOfficeMap.test.tsx
├── hooks/                 # Custom hook tests
│   └── useIEBCOffices.test.ts
├── integration/           # End-to-end tests
│   └── e2e.test.ts
├── utils/                 # Test utilities and helpers
│   └── testUtils.ts
└── README.md              # This file
```

## Running Tests

### Unit Tests
```bash
# Run all unit tests
npm run test

# Run tests in watch mode
npm run test:ui

# Run tests once and exit
npm run test:run

# Run tests with coverage
npm run test:coverage
```

### End-to-End Tests
```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui
```

## Test Coverage

The test suite covers:

### API Endpoints
- Office listing, searching, and nearby offices
- Verification confirmations and statistics
- Contribution submissions and voting
- Status reports and contact updates
- Admin operations (approve/reject contributions)

### Components
- Map rendering and interaction
- Search functionality
- Office detail views
- Form submissions
- Error states

### Hooks
- Data fetching and caching
- User interactions
- Error handling
- Real-time updates

### Integration
- Complete user workflows
- Cross-component interactions
- API integration
- Geolocation features

## Test Data

Tests use mock data defined in `testUtils.ts`:
- Mock offices with realistic Kenyan locations
- Mock users with different roles
- Mock contributions and confirmations
- Mock API responses

## Configuration

### Vitest Configuration
- Environment: jsdom
- Global test setup in `setup.ts`
- Coverage reporting with v8
- Path aliases configured for easy imports

### Playwright Configuration
- Multiple browsers (Chrome, Firefox, Safari)
- Mobile viewports
- Automatic server startup
- Screenshot and video capture on failure

## Best Practices

1. **Test Isolation**: Each test should be independent and not rely on other tests
2. **Mock External Dependencies**: Use mocks for APIs, geolocation, and browser APIs
3. **Descriptive Tests**: Use clear test descriptions that explain what is being tested
4. **Coverage**: Aim for high coverage of critical paths and user interactions
5. **Error Scenarios**: Test both success and error cases
6. **Accessibility**: Include accessibility tests where relevant

## Debugging Tests

### Unit Tests
- Use `console.log` within tests for debugging
- Use VS Code debugger with Vitest extension
- Run tests with `--no-coverage` for faster execution

### E2E Tests
- Use `page.pause()` to pause execution
- Use `--debug` flag for step-by-step execution
- Use browser developer tools during test runs

## CI/CD Integration

Tests are configured to run in CI/CD:
- Unit tests run on every PR
- E2E tests run on merge to main
- Coverage reports are generated and uploaded
- Failed tests block deployment

## Adding New Tests

When adding new features:

1. Add unit tests for individual functions/components
2. Add integration tests for user workflows
3. Update test utilities if needed
4. Ensure coverage remains high
5. Document any special test requirements

## Troubleshooting

### Common Issues
- **Module not found**: Check path aliases in vitest.config.ts
- **Timeout errors**: Increase timeout in test configuration
- **Flaky tests**: Ensure proper cleanup and isolation
- **Browser errors**: Check playwright configuration and dependencies

### Getting Help
- Check Vitest documentation: https://vitest.dev/
- Check Playwright documentation: https://playwright.dev/
- Review existing test patterns in the codebase
