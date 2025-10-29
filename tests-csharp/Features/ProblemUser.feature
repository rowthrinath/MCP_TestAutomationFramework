Feature: Problem User Scenarios
    As a problem user
    I want to use the online shop
    So that I can purchase items despite broken images

    Background:
        Given I navigate to the login page

    Scenario: Login successfully with problem user
        When I login with username "problem_user" and password "secret_sauce"
        Then I should be redirected to the inventory page

    Scenario: Verify broken images for problem user
        Given I am logged in as "problem_user"
        Then I should see inventory items
        And some images may be broken
        And items should still have titles and prices

    Scenario: Add items to cart despite broken images
        Given I am logged in as "problem_user"
        When I add item at index 0 to cart
        Then the cart should contain at least 1 item

    Scenario: Complete shopping flow despite broken images
        Given I am logged in as "problem_user"
        When I add item at index 0 to cart
        And I add item at index 1 to cart
        And I navigate to cart
        And I proceed to checkout
        And I fill checkout form with first name "John", last name "Doe", and postal code "12345"
        And I continue to checkout overview
        Then the order completion may succeed or remain on checkout page

