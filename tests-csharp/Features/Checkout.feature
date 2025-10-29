Feature: Checkout Process
    As a logged in user
    I want to complete the checkout process
    So that I can purchase my selected items

    Background:
        Given I am logged in as "standard_user"
        And I have items in my cart
        And I navigate to cart
        And I proceed to checkout

    Scenario: Fill checkout information
        When I fill checkout form with first name "John", last name "Doe", and postal code "12345"
        And I continue to checkout overview
        Then I should be on the checkout overview page

    Scenario: View checkout overview
        Given I have filled checkout information
        When I view checkout overview
        Then I should see order summary
        And I should see subtotal
        And I should see tax
        And I should see total

    Scenario: Cancel checkout
        When I cancel checkout
        Then I should be redirected to cart page

    Scenario: Complete order
        Given I have filled checkout information
        When I finish the order
        Then I should be on the checkout complete page
        And I should see the order complete message

    Scenario: Cancel from overview
        Given I have filled checkout information
        When I cancel from overview
        Then I should be redirected to inventory page

