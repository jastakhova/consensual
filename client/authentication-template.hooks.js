angular
    .module('yourModule')
    .run(function ($ionicHistory, $state) {
    AccountsTemplates.options.onSubmitHook = onSubmitHook;
    AccountsTemplates.options.onLogoutHook = onLogoutHook;
    
    function onSubmitHook(error, state) {
      if (!error) {
        if (state === "signIn" || state === "signUp") {
          $ionicHistory.nextViewOptions({
            historyRoot: true
          });

          $state.go("logged-in-greeting-page");
        }
      }
    }

    function onLogoutHook() {
      $ionicHistory.nextViewOptions({
        historyRoot: true
      });

      $state.go("login");
    }

    });
