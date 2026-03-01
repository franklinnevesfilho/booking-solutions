---
name: android
description: Architecture, Jetpack Compose, Navigation3 KMP, and Koin DI rules for Android apps.
---

# 2026 Android & Compose Architecture Standards

This skill defines the rules for building modern Android applications (Jetpack Compose, Navigation3, Koin) adhering to strict 2026 UDF patterns.

## 1. Jetpack Compose UI Rules

1. **Model-View-Intent (MVI) & UDF**:
   - **Model**: Expose a single, immutable `ViewState` (Data Class) from the ViewModel. Do not expose multiple independent state flows unless strictly isolated.
   - **View**: A pure function rendering the Model. State flows down.
   - **Intent**: User actions are routed to the ViewModel as explicit Intents/Events. Events flow up.
2. **Screen vs View Approach**:
   - `<Name>Screen`: Handles DI, Navigation3 KMP routing, and connects the `ViewModel` to the UI.
   - `<Name>View(state, onEvent)`: A completely pure, stateless Composable.
3. **Minimize Logic in Compose**:
   - Do NOT use `remember` for business logic. Business logic belongs in the ViewModel.
4. **Performance (2026 Standards)**:
   - Assume **Strong Skipping Mode** is enabled. Do not manually wrap lambdas in `remember`.
   - Pass modifier chains explicitly: `modifier: Modifier = Modifier`.
5. **Visibility**:
   - `@Preview` Composables MUST be `private` or restricted visibility.
   - Do NOT make Composable functions `public` unless intended as an external design system component.

## 2. Navigation3 KMP (Routing & State)

If using Navigation3 KMP for architecture:

1. **ViewModel = Logic + State**: The ViewModel handles all business logic, manages the CoroutineScope, and exposes state to the UI.
2. **ViewModel Interface**:
   - Public functions inside a ViewModel MUST represent user intents/events and generally return `Unit`.
   - Any function computing values internally should be `private`.
   - State should be exposed as an immutable `StateFlow`.
3. **Routing (Navigation3 KMP)**:
   - Treat navigation strictly as **state management** (part of the ViewModel or Component).
   - Keep navigation execution strictly inside the `<Name>Screen` wrapper, NOT inside the pure `<Name>View`.
   - Use strongly typed destinations (Objects or Data Classes).
   - **Crucial**: Apply polymorphic `@Serializable` annotations to your destination keys so they serialize correctly across non-JVM platforms (iOS/Web).

## 3. Dependency Injection (Koin)

If using Koin:

- Prefer `single` and `factory` instead of `bind` with generic provider/singleton blocks for clearer syntax and safety.
