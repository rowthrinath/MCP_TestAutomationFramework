Feature: Performance Glitch User Scenarios
    As a performance glitch user
    I want to use the online shop
    So that I can purchase items despite slow loading times

    Background:
        Given I navigate to the login page

    Scenario: Login successfully with performance glitch user
        When I login with username "performance_glitch_user" and password "secret_sauce"
        Then I should be redirected to the inventory page
        And the page should load within extended timeout

    Scenario: Handle slow loading times gracefully
        Given I am logged in as "performance_glitch_user"
        Then I should see inventory items
        And images should eventually load

    Scenario: Complete shopping flow with slow performance
        Given I am logged in as "performance_glitch_user"
        When I add item at index 0 to cart
        And I add item at index 1 to cart
        And I navigate to cart
        And I proceed to checkout
        And I fill checkout form with first name "John", last name "Doe", and postal code "12345"
        And I continue to checkout overview
        And I finish the order
        Then I should be on the checkout complete page
        And I should see the order complete message

