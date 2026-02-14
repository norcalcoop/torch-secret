/**
 * Error page for unmatched routes and error states.
 */

export type ErrorType = 'not_found' | 'generic';

export function renderErrorPage(
  container: HTMLElement,
  errorType: ErrorType,
): void {
  const heading = document.createElement('h1');
  heading.className = 'text-2xl font-bold mb-4';

  const message = document.createElement('p');
  message.className = 'text-gray-500 mb-6';

  const link = document.createElement('a');
  link.href = '/';
  link.className = 'text-primary-600 hover:text-primary-700 underline';
  link.textContent = 'Go to homepage';
  link.addEventListener('click', (e) => {
    e.preventDefault();
    import('../router.js').then((mod) => mod.navigate('/'));
  });

  switch (errorType) {
    case 'not_found':
      heading.textContent = 'Page Not Found';
      message.textContent = 'The page you are looking for does not exist.';
      break;
    case 'generic':
    default:
      heading.textContent = 'Something Went Wrong';
      message.textContent =
        'An unexpected error occurred. Please try again later.';
      break;
  }

  container.appendChild(heading);
  container.appendChild(message);
  container.appendChild(link);
}
