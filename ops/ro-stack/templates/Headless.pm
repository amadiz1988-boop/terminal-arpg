package Interface::Headless;

use strict;
use warnings;
use Interface;
use base qw(Interface);

sub new {
	my $class = shift;
	binmode STDOUT, ':encoding(UTF-8)';
	STDOUT->autoflush(1);
	return bless {}, $class;
}

sub getInput {
	return undef;
}

sub writeOutput {
	my ($self, $type, $message, $domain) = @_;
	print STDOUT $message;
}

sub title {
	my ($self, $title) = @_;
	$self->{title} = $title if defined $title;
	return $self->{title};
}

1;
