Feature: End-to-End Shopping Flow
    As a standard user
    I want to complete a full shopping journey
    So that I can purchase items from the online shop

    Background:
        Given I navigate to the login page

    @e2e
    Scenario: Complete full shopping flow
        Given I am logged in as "standard_user"
        When I add 3 items to cart
        And I navigate to cart
        And I remove 1 item from cart
        And I proceed to checkout
        And I fill checkout form with first name "John", last name "Doe", and postal code "12345"
        And I continue to checkout overview
        Then I should see 2 items in order summary
        When I finish the order
        Then I should be on the checkout complete page
        And I should see the order complete message

