Feature: Shopping Cart
    As a logged in user
    I want to manage my shopping cart
    So that I can review and modify my selected items

    Background:
        Given I am logged in as "standard_user"
        And I have 2 items in my cart
        And I navigate to cart

    Scenario: View cart items
        Then I should see the cart page
        And the cart should contain 2 items

    Scenario: View cart item details
        Then item at index 0 should have a title
        And item at index 0 should have a price
        And item at index 0 should have quantity "1"

    Scenario: Remove item from cart
        When I remove item at index 0 from cart
        Then the cart should contain 1 item

    Scenario: Continue shopping
        When I continue shopping
        Then I should be redirected to the inventory page

    Scenario: Proceed to checkout
        When I proceed to checkout
        Then I should be on the checkout page

    Scenario: Handle empty cart
        When I remove all items from cart
        Then the cart should be empty

