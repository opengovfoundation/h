import json

from pyramid.httpexceptions import HTTPFound
from pyramid.view import view_config
from sanction import client


@view_config(route_name='oauth_login')
def oauth_request(request):
    c = client.Client(
        auth_endpoint='https://account.app.net/oauth/authenticate',
        client_id=request.registry.settings['oauth.client_id'],
        redirect_uri=request.route_url('oauth_success')
    )
    l = c.auth_uri(
        scope=['basic', 'follow', 'public_messages', 'write_post'],
        state=request.session.new_csrf_token(),
    )
    return HTTPFound(location=l)


@view_config(
    route_name='oauth_success',
    renderer='h:templates/oauth_success.pt',
    layout='auth',
)
def oauth_login(request):
    assert(request.params['state'] == request.session.get_csrf_token())
    c = client.Client(
        client_id=request.registry.settings['oauth.client_id'],
        client_secret=request.registry.settings['oauth.client_secret'],
        token_endpoint='https://account.app.net/oauth/access_token',
        resource_endpoint='https://alpha-api.app.net',
        redirect_uri=request.current_route_url(),
    )
    c.request_token(code=request.params['code'])
    u = c.request('/stream/0/users/me')
    p = dict(username=u['data']['username'], provider='alpha.app.net')
    return {
        'result': json.dumps({
            'access_token': c.access_token,
            'persona': p,
            'personas': [p],
        })
    }


def includeme(config):
    config.add_route('oauth_login', '/oauth/login')
    config.add_route('oauth_success', '/oauth/success')
    config.scan(__name__)
