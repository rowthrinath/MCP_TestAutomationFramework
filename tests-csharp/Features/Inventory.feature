Feature: Inventory Management
    As a logged in user
    I want to view and interact with inventory items
    So that I can add items to my cart

    Background:
        Given I am logged in as "standard_user"
        And I navigate to the inventory page

    Scenario: View inventory items
        Then I should see inventory items displayed
        And the inventory should contain at least 1 item

    Scenario: Add item to cart
        Given the cart is empty
        When I add item at index 0 to cart
        Then the cart should contain 1 item
        And the shopping cart badge should display "1"

    Scenario: Remove item from cart
        Given I have 1 item in cart
        When I remove item at index 0 from cart
        Then the cart should contain 0 items

    Scenario: Add multiple items to cart
        When I add item at index 0 to cart
        And I add item at index 1 to cart
        And I add item at index 2 to cart
        Then the cart should contain 3 items

    Scenario: Sort inventory by name ascending
        When I sort items by "az"
        Then items should be sorted alphabetically ascending

    Scenario: Sort inventory by name descending
        When I sort items by "za"
        Then items should be sorted alphabetically descending

    Scenario: Sort inventory by price low to high
        When I sort items by "lohi"
        Then items should be sorted by price ascending

    Scenario: Sort inventory by price high to low
        When I sort items by "hilo"
        Then items should be sorted by price descending

    Scenario: Navigate to cart page
        When I navigate to cart
        Then I should be on the cart page

