Feature: Login Functionality
    As a user
    I want to login to the online shop
    So that I can access my account and shop

    Background:
        Given I navigate to the login page

    @standard_user
    Scenario: Successful login with standard user
        When I login with username "standard_user" and password "secret_sauce"
        Then I should be redirected to the inventory page
        And the inventory page should be displayed

    @locked_out_user
    Scenario: Failed login with locked out user
        When I login with username "locked_out_user" and password "secret_sauce"
        Then I should see an error message
        And the error message should contain "Sorry, this user has been locked out"

    @problem_user
    Scenario: Successful login with problem user
        When I login with username "problem_user" and password "secret_sauce"
        Then I should be redirected to the inventory page

    @performance_glitch_user
    Scenario: Successful login with performance glitch user
        When I login with username "performance_glitch_user" and password "secret_sauce"
        Then I should be redirected to the inventory page

    Scenario: Failed login with invalid credentials
        When I login with username "invalid_user" and password "invalid_password"
        Then I should see an error message
        And the error message should contain "Username and password do not match"

    Scenario: Failed login with empty username
        When I login with username "" and password "secret_sauce"
        Then I should see an error message
        And the error message should contain "Username is required"

    Scenario: Failed login with empty password
        When I login with username "standard_user" and password ""
        Then I should see an error message
        And the error message should contain "Password is required"

